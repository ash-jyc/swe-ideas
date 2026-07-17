import { useEffect, useState } from 'react';
import type { ProjectFileTree } from '@vibe/shared';
import { FileTree } from '../FileTree';
import { CodeEditor } from '../CodeEditor';
import { api } from '../../lib/api';

export function CodeTab({
  projectId,
  fileTree,
  selected,
  onSelect,
}: {
  projectId: string;
  fileTree: ProjectFileTree;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api
      .getFile(projectId, selected)
      .then((f) => {
        setContent(f.content);
        setDraft(f.content);
      })
      .catch(() => {
        setContent('');
        setDraft('');
      })
      .finally(() => setLoading(false));
  }, [projectId, selected]);

  const dirty = draft !== content;

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.saveFile(projectId, selected, draft);
      setContent(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div
        style={{
          width: 230,
          borderRight: '1px solid var(--border)',
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        <FileTree root={fileTree.root} selected={selected} onSelect={onSelect} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div
              className="spread"
              style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}
            >
              <span className="mono faint" style={{ fontSize: 12 }}>
                {selected}
              </span>
              {dirty && (
                <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save & reload'}
                </button>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {!loading && (
                <CodeEditor path={selected} value={draft} onChange={setDraft} />
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="faint">
            Select a file to view its code
          </div>
        )}
      </div>
    </div>
  );
}
