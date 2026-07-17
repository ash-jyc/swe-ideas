// Codegen file-op protocol types.
//
// The model emits structured blocks the server parses deterministically:
//   <vibefile path="rel/path">...full contents...</vibefile>   (create/replace)
//   <vibedelete path="rel/path"/>                               (delete)
// Everything outside blocks is prose and becomes the turn summary.

export type FileOp =
  | { op: 'write'; path: string; content: string }
  | { op: 'delete'; path: string };

export interface ParsedResponse {
  ops: FileOp[];
  summary: string;
  /** Non-fatal problems (rejected paths, malformed blocks). */
  warnings: string[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileTreeNode[];
}

export interface ProjectFileTree {
  root: FileTreeNode;
  /** Flat list of file paths for convenience. */
  paths: string[];
}
