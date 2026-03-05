// Virtual file system as a plain Record<string, string> (path → content).
// Directories are implicit — they exist when files beneath them exist.

export type Files = Record<string, string>;

export function normalizePath(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/+/g, "/");
  if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function fsCreateFile(files: Files, path: string, content = ""): string {
  const p = normalizePath(path);
  if (files[p] !== undefined) {
    // Overwrite if exists (AI often re-creates files)
    files[p] = content;
    return `Updated: ${p}`;
  }
  files[p] = content;
  return `Created: ${p}`;
}

export function fsViewFile(files: Files, path: string, range?: [number, number]): string {
  const p = normalizePath(path);

  // Try as file
  if (files[p] !== undefined) {
    const lines = files[p].split("\n");
    if (range) {
      const [start, end] = range;
      const s = Math.max(1, start);
      const e = end === -1 ? lines.length : Math.min(lines.length, end);
      return lines.slice(s - 1, e).map((l, i) => `${s + i}\t${l}`).join("\n");
    }
    return lines.map((l, i) => `${i + 1}\t${l}`).join("\n") || "(empty file)";
  }

  // Try as directory — list direct children
  const prefix = p === "/" ? "/" : p + "/";
  const seen = new Set<string>();
  const entries: Array<{ name: string; isDir: boolean }> = [];

  for (const key of Object.keys(files)) {
    const rest = p === "/" ? key.slice(1) : key.startsWith(prefix) ? key.slice(prefix.length) : null;
    if (!rest) continue;
    const slashIdx = rest.indexOf("/");
    const name = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    entries.push({ name, isDir: slashIdx !== -1 });
  }

  if (entries.length === 0) return p === "/" ? "(empty)" : `Error: Not found: ${p}`;
  return entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `${e.isDir ? "[DIR]" : "[FILE]"} ${e.name}`)
    .join("\n");
}

export function fsReplaceInFile(files: Files, path: string, oldStr: string, newStr: string): string {
  const p = normalizePath(path);
  if (files[p] === undefined) return `Error: File not found: ${p}`;
  if (!oldStr || !files[p].includes(oldStr)) return `Error: String not found in file: "${oldStr}"`;
  const escaped = oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const count = (files[p].match(new RegExp(escaped, "g")) || []).length;
  files[p] = files[p].split(oldStr).join(newStr);
  return `Replaced ${count} occurrence(s) in ${p}`;
}

export function fsInsertInFile(files: Files, path: string, line: number, text: string): string {
  const p = normalizePath(path);
  if (files[p] === undefined) return `Error: File not found: ${p}`;
  const lines = files[p].split("\n");
  if (line < 0 || line > lines.length) return `Error: Invalid line number: ${line}`;
  lines.splice(line, 0, text);
  files[p] = lines.join("\n");
  return `Inserted at line ${line} in ${p}`;
}

export function fsDeleteFile(files: Files, path: string): boolean {
  const p = normalizePath(path);
  const prefix = p + "/";
  let deleted = false;
  for (const key of Object.keys(files)) {
    if (key === p || key.startsWith(prefix)) {
      delete files[key];
      deleted = true;
    }
  }
  return deleted;
}

export function fsRenameFile(files: Files, oldPath: string, newPath: string): boolean {
  const oldP = normalizePath(oldPath);
  const newP = normalizePath(newPath);
  if (oldP === "/" || newP === "/") return false;

  // Rename single file
  if (files[oldP] !== undefined) {
    if (files[newP] !== undefined) return false;
    files[newP] = files[oldP];
    delete files[oldP];
    return true;
  }

  // Rename directory (all files under the prefix)
  const prefix = oldP + "/";
  const toMove = Object.keys(files).filter((k) => k.startsWith(prefix));
  if (toMove.length === 0) return false;
  for (const key of toMove) {
    files[newP + key.slice(oldP.length)] = files[key];
    delete files[key];
  }
  return true;
}
