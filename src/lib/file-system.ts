export interface FileNode {
  type: "file" | "directory";
  name: string;
  path: string;
  content?: string;
  children?: Map<string, FileNode>;
}

export class VirtualFileSystem {
  private files: Map<string, FileNode> = new Map();
  private root: FileNode;

  constructor() {
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
  }

  private normalizePath(path: string): string {
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    path = path.replace(/\/+/g, "/");
    return path;
  }

  private getParentPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/");
    parts.pop();
    return parts.length === 1 ? "/" : parts.join("/");
  }

  private getFileName(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/");
    return parts[parts.length - 1];
  }

  private getParentNode(path: string): FileNode | null {
    const parentPath = this.getParentPath(path);
    return this.files.get(parentPath) || null;
  }

  createFile(path: string, content: string = ""): FileNode | null {
    const normalized = this.normalizePath(path);

    if (this.files.has(normalized)) {
      return null;
    }

    const parts = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const fileName = this.getFileName(normalized);
    const file: FileNode = {
      type: "file",
      name: fileName,
      path: normalized,
      content,
    };

    this.files.set(normalized, file);
    parent.children!.set(fileName, file);

    return file;
  }

  createDirectory(path: string): FileNode | null {
    const normalized = this.normalizePath(path);

    if (this.files.has(normalized)) {
      return null;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const dirName = this.getFileName(normalized);
    const directory: FileNode = {
      type: "directory",
      name: dirName,
      path: normalized,
      children: new Map(),
    };

    this.files.set(normalized, directory);
    parent.children!.set(dirName, directory);

    return directory;
  }

  readFile(path: string): string | null {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return null;
    }

    return file.content || "";
  }

  updateFile(path: string, content: string): boolean {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return false;
    }

    file.content = content;
    return true;
  }

  deleteFile(path: string): boolean {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);

    if (!file || normalized === "/") {
      return false;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return false;
    }

    if (file.type === "directory" && file.children) {
      for (const [_, child] of file.children) {
        this.deleteFile(child.path);
      }
    }

    parent.children!.delete(file.name);
    this.files.delete(normalized);

    return true;
  }

  rename(oldPath: string, newPath: string): boolean {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);

    if (normalizedOld === "/" || normalizedNew === "/") {
      return false;
    }

    const sourceNode = this.files.get(normalizedOld);
    if (!sourceNode) {
      return false;
    }

    if (this.files.has(normalizedNew)) {
      return false;
    }

    const oldParent = this.getParentNode(normalizedOld);
    if (!oldParent || oldParent.type !== "directory") {
      return false;
    }

    const newParentPath = this.getParentPath(normalizedNew);
    if (!this.exists(newParentPath)) {
      const parts = newParentPath.split("/").filter(Boolean);
      let currentPath = "";

      for (const part of parts) {
        currentPath += "/" + part;
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }
    }

    const newParent = this.getParentNode(normalizedNew);
    if (!newParent || newParent.type !== "directory") {
      return false;
    }

    oldParent.children!.delete(sourceNode.name);

    const newName = this.getFileName(normalizedNew);
    sourceNode.name = newName;
    sourceNode.path = normalizedNew;

    newParent.children!.set(newName, sourceNode);

    this.files.delete(normalizedOld);
    this.files.set(normalizedNew, sourceNode);

    if (sourceNode.type === "directory" && sourceNode.children) {
      this.updateChildrenPaths(sourceNode);
    }

    return true;
  }

  private updateChildrenPaths(node: FileNode): void {
    if (node.type === "directory" && node.children) {
      for (const [_, child] of node.children) {
        const oldChildPath = child.path;
        child.path = node.path + "/" + child.name;

        this.files.delete(oldChildPath);
        this.files.set(child.path, child);

        if (child.type === "directory") {
          this.updateChildrenPaths(child);
        }
      }
    }
  }

  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    return this.files.has(normalized);
  }

  getNode(path: string): FileNode | null {
    const normalized = this.normalizePath(path);
    return this.files.get(normalized) || null;
  }

  listDirectory(path: string): FileNode[] | null {
    const normalized = this.normalizePath(path);
    const dir = this.files.get(normalized);

    if (!dir || dir.type !== "directory") {
      return null;
    }

    return Array.from(dir.children?.values() || []);
  }

  getAllFiles(): Map<string, string> {
    const fileMap = new Map<string, string>();

    for (const [path, node] of this.files) {
      if (node.type === "file") {
        fileMap.set(path, node.content || "");
      }
    }

    return fileMap;
  }

  serialize(): Record<string, FileNode> {
    const result: Record<string, FileNode> = {};

    for (const [path, node] of this.files) {
      if (node.type === "directory") {
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
        };
      } else {
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
          content: node.content,
        };
      }
    }

    return result;
  }

  deserialize(data: Record<string, string>): void {
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    const paths = Object.keys(data).sort();

    for (const path of paths) {
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }

      this.createFile(path, data[path]);
    }
  }

  deserializeFromNodes(data: Record<string, FileNode>): void {
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    const paths = Object.keys(data).sort();

    for (const path of paths) {
      if (path === "/") continue;

      const node = data[path];
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }

      if (node.type === "file") {
        this.createFile(path, node.content || "");
      } else if (node.type === "directory") {
        this.createDirectory(path);
      }
    }
  }

  viewFile(path: string, viewRange?: [number, number]): string {
    const file = this.getNode(path);
    if (!file) {
      return `File not found: ${path}`;
    }

    if (file.type === "directory") {
      const children = this.listDirectory(path);
      if (!children || children.length === 0) {
        return "(empty directory)";
      }

      return children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => {
          const prefix = child.type === "directory" ? "[DIR]" : "[FILE]";
          return `${prefix} ${child.name}`;
        })
        .join("\n");
    }

    const content = file.content || "";

    if (viewRange && viewRange.length === 2) {
      const lines = content.split("\n");
      const [start, end] = viewRange;
      const startLine = Math.max(1, start);
      const endLine = end === -1 ? lines.length : Math.min(lines.length, end);

      const viewedLines = lines.slice(startLine - 1, endLine);
      return viewedLines
        .map((line, index) => `${startLine + index}\t${line}`)
        .join("\n");
    }

    const lines = content.split("\n");
    return (
      lines.map((line, index) => `${index + 1}\t${line}`).join("\n") ||
      "(empty file)"
    );
  }

  createFileWithParents(path: string, content: string = ""): string {
    if (this.exists(path)) {
      return `Error: File already exists: ${path}`;
    }

    const parts = path.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    this.createFile(path, content);
    return `File created: ${path}`;
  }

  replaceInFile(path: string, oldStr: string, newStr: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";

    if (!oldStr || !content.includes(oldStr)) {
      return `Error: String not found in file: "${oldStr}"`;
    }

    const occurrences = (
      content.match(
        new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;

    const updatedContent = content.split(oldStr).join(newStr || "");
    this.updateFile(path, updatedContent);

    return `Replaced ${occurrences} occurrence(s) of the string in ${path}`;
  }

  insertInFile(path: string, insertLine: number, text: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";
    const lines = content.split("\n");

    if (
      insertLine === undefined ||
      insertLine < 0 ||
      insertLine > lines.length
    ) {
      return `Error: Invalid line number: ${insertLine}. File has ${lines.length} lines.`;
    }

    lines.splice(insertLine, 0, text || "");
    const updatedContent = lines.join("\n");
    this.updateFile(path, updatedContent);

    return `Text inserted at line ${insertLine} in ${path}`;
  }

  reset(): void {
    this.files.clear();
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
  }
}

export const fileSystem = new VirtualFileSystem();
