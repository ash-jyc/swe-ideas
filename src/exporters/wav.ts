/** 16-bit PCM WAV encode/decode (mono). Shared by exports, fixtures, and tests. */

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function decodeWav(data: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, false) !== 0x52494646) throw new Error("Not a RIFF file");
  const sampleRate = view.getUint32(24, true);
  const channels = view.getUint16(22, true);
  const bits = view.getUint16(34, true);
  if (bits !== 16) throw new Error(`Only 16-bit WAV supported, got ${bits}`);

  // Find the data chunk (fmt may be followed by other chunks).
  let pos = 12;
  while (pos < data.length) {
    const id = view.getUint32(pos, false);
    const size = view.getUint32(pos + 4, true);
    if (id === 0x64617461) {
      // "data"
      const frames = Math.floor(size / 2 / channels);
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        // Mixdown to mono if needed.
        let acc = 0;
        for (let c = 0; c < channels; c++) {
          acc += view.getInt16(pos + 8 + (i * channels + c) * 2, true);
        }
        samples[i] = acc / channels / 0x8000;
      }
      return { samples, sampleRate };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error("No data chunk found");
}
