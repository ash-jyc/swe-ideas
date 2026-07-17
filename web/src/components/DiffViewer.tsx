import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';

interface Props {
  before: string;
  after: string;
}

/** Side-by-side merge/diff view of a file's before/after content. */
export function DiffViewer({ before, after }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const shared = [
      lineNumbers(),
      oneDark,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.theme({
        '&': { fontSize: '12.5px' },
        '.cm-scroller': { fontFamily: 'var(--mono)' },
      }),
    ];
    const mv = new MergeView({
      a: { doc: before, extensions: shared },
      b: { doc: after, extensions: shared },
      parent: host.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
      highlightChanges: true,
      gutter: true,
    });
    return () => mv.destroy();
  }, [before, after]);

  return <div ref={host} style={{ height: '100%', overflow: 'auto' }} />;
}
