/** Microphone recording and audio-file decoding, both → mono Float32 PCM. */

export interface CapturedAudio {
  samples: Float32Array;
  sampleRate: number;
}

export async function decodeAudioFile(file: File | Blob): Promise<CapturedAudio> {
  const arrayBuf = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const mono = mixdown(audioBuf);
    return { samples: mono, sampleRate: audioBuf.sampleRate };
  } finally {
    void ctx.close();
  }
}

function mixdown(buf: AudioBuffer): Float32Array {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

export interface Recorder {
  /** Called ~60x/sec with the newest chunk while recording. */
  onChunk?: (chunk: Float32Array, sampleRate: number) => void;
  stop(): Promise<CapturedAudio>;
}

/** Start a mic recording. Collects raw PCM via an AudioWorklet-free path
 *  (ScriptProcessor is deprecated but universally supported and fine for
 *  a capture buffer; the DSP runs after recording stops). */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const recorder: Recorder = {
    async stop() {
      proc.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const sampleRate = ctx.sampleRate;
      await ctx.close();
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const samples = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        samples.set(c, off);
        off += c.length;
      }
      return { samples, sampleRate };
    },
  };
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    recorder.onChunk?.(data, ctx.sampleRate);
  };
  source.connect(proc);
  proc.connect(ctx.destination); // required by some browsers to keep the node alive
  return recorder;
}
