import { useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';

function langFor(path: string): Extension[] {
  if (/\.(jsx?|mjs|cjs|tsx?)$/.test(path)) return [javascript({ jsx: true, typescript: /\.tsx?$/.test(path) })];
  if (/\.html?$/.test(path)) return [html()];
  if (/\.css$/.test(path)) return [css()];
  if (/\.json$/.test(path)) return [json()];
  return [];
}

interface Props {
  path: string;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function CodeEditor({ path, value, readOnly, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        oneDark,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: 'var(--mono)' },
          '&.cm-focused': { outline: 'none' },
        }),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(!!readOnly),
        ...langFor(path),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && onChange) onChange(u.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    return () => v.destroy();
    // Recreate the editor when the file identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly]);

  // Sync external value changes (e.g. new turn) without losing the editor.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <div ref={host} style={{ height: '100%', overflow: 'hidden' }} />;
}
