import { describe, it, expect } from 'vitest';
import { buildFileTree } from './fileTree.js';

describe('buildFileTree', () => {
  it('nests files into directories and sorts dirs first', () => {
    const tree = buildFileTree([
      { path: 'server.js', size: 10 },
      { path: 'public/index.html', size: 20 },
      { path: 'public/app.js', size: 30 },
    ]);
    expect(tree.paths).toContain('public/app.js');
    const names = tree.root.children!.map((c) => c.name);
    // "public" (dir) sorts before "server.js" (file)
    expect(names).toEqual(['public', 'server.js']);
    const pub = tree.root.children!.find((c) => c.name === 'public')!;
    expect(pub.type).toBe('dir');
    expect(pub.children!.map((c) => c.name).sort()).toEqual(['app.js', 'index.html']);
  });

  it('handles an empty project', () => {
    const tree = buildFileTree([]);
    expect(tree.paths).toEqual([]);
    expect(tree.root.children).toEqual([]);
  });
});
