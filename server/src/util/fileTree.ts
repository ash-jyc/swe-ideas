import type { FileTreeNode, ProjectFileTree } from '@vibe/shared';

/** Build a nested file tree from a flat list of {path, size} entries. */
export function buildFileTree(
  files: { path: string; size: number }[],
): ProjectFileTree {
  const root: FileTreeNode = { name: '', path: '', type: 'dir', children: [] };
  const paths = files.map((f) => f.path).sort();

  for (const file of files) {
    const segments = file.path.split('/');
    let node = root;
    let acc = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      acc = acc ? `${acc}/${seg}` : seg;
      const isLeaf = i === segments.length - 1;
      node.children ??= [];
      let child = node.children.find((c) => c.name === seg);
      if (!child) {
        child = isLeaf
          ? { name: seg, path: acc, type: 'file', size: file.size }
          : { name: seg, path: acc, type: 'dir', children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }

  sortTree(root);
  return { root, paths };
}

function sortTree(node: FileTreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sortTree(c);
}
