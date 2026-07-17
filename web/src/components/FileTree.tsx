import { useState } from 'react';
import type { FileTreeNode } from '@vibe/shared';

interface Props {
  root: FileTreeNode;
  selected: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ root, selected, onSelect }: Props) {
  return (
    <div style={{ padding: '6px 4px', fontSize: 13 }}>
      {(root.children ?? []).map((c) => (
        <TreeNode key={c.path} node={c} depth={0} selected={selected} onSelect={onSelect} />
      ))}
      {(root.children ?? []).length === 0 && (
        <div className="faint" style={{ padding: 12, fontSize: 12 }}>
          No files yet. Send a prompt to generate your app.
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const pad = 8 + depth * 14;

  if (node.type === 'dir') {
    return (
      <div>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{ ...rowStyle, paddingLeft: pad, color: 'var(--text-dim)' }}
        >
          <span style={{ width: 12, display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
          <span>{node.name}</span>
        </div>
        {open &&
          (node.children ?? []).map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
      </div>
    );
  }

  const isSel = selected === node.path;
  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        ...rowStyle,
        paddingLeft: pad + 12,
        background: isSel ? 'var(--bg-3)' : 'transparent',
        color: isSel ? 'var(--text)' : 'var(--text-dim)',
      }}
      className="mono"
    >
      {node.name}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
