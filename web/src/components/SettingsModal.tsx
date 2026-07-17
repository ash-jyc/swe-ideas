import { useState } from 'react';
import type { ByokCredentials, ProviderId } from '@vibe/shared';
import { PROVIDER_PRESETS } from '@vibe/shared';
import { loadCreds, saveCreds } from '../lib/keys';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const existing = loadCreds();
  const [provider, setProvider] = useState<ProviderId>(existing?.provider ?? 'mock');
  const [model, setModel] = useState(existing?.model ?? 'mock-todo-app');
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');

  const preset = PROVIDER_PRESETS.find((p) => p.id === provider)!;

  function pickProvider(id: ProviderId) {
    setProvider(id);
    const p = PROVIDER_PRESETS.find((x) => x.id === id)!;
    setModel(p.models[0]?.id ?? '');
    if (p.defaultBaseUrl) setBaseUrl(p.defaultBaseUrl);
  }

  function save() {
    const creds: ByokCredentials = {
      provider,
      model: model.trim(),
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
    };
    saveCreds(creds);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Model settings</h2>
        <div className="sub">
          Bring your own key. Keys are stored only in this browser and sent with each request —
          never saved on the server.
        </div>

        <div className="field">
          <label className="label">Provider</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PROVIDER_PRESETS.map((p) => (
              <button
                key={p.id}
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  borderColor: provider === p.id ? 'var(--accent)' : 'var(--border)',
                  background: provider === p.id ? 'var(--bg-3)' : 'var(--bg-1)',
                }}
                onClick={() => pickProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">Model</label>
          {preset.models.length > 0 ? (
            <input
              className="input"
              list="model-list"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model id"
            />
          ) : (
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
          )}
          <datalist id="model-list">
            {preset.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
        </div>

        {preset.needsBaseUrl && (
          <div className="field">
            <label className="label">Base URL</label>
            <input
              className="input mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-endpoint/v1"
            />
          </div>
        )}

        {preset.needsKey && (
          <div className="field">
            <label className="label">API key</label>
            <input
              className="input mono"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
          </div>
        )}

        {provider === 'mock' && (
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            The mock provider needs no key — it streams a scripted app so you can try the platform
            instantly. Pick <b>mock-vulnerable</b> to generate an app with planted vulnerabilities.
          </div>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
