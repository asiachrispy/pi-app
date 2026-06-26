import { isAbsolute, relative } from "node:path";

/** 判定 target 是否在 root 之下（含 root 自身）。 */
export function pathBelongsToRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && rel !== ".." && !isAbsolute(rel));
}
