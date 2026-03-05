"use client";

import { useState } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(files: Record<string, string>): TreeNode[] {
  // Collect implicit directories from file paths
  const dirs = new Set<string>();
  for (const path of Object.keys(files)) {
    const parts = path.split("/").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      dirs.add("/" + parts.slice(0, i + 1).join("/"));
    }
  }

  function getChildren(parentPath: string): TreeNode[] {
    const prefix = parentPath === "/" ? "/" : parentPath + "/";
    const seen = new Set<string>();
    const nodes: TreeNode[] = [];

    for (const p of [...dirs, ...Object.keys(files)]) {
      const rest =
        parentPath === "/"
          ? p.slice(1)
          : p.startsWith(prefix)
          ? p.slice(prefix.length)
          : null;
      if (!rest || rest.includes("/")) continue;
      if (seen.has(rest)) continue;
      seen.add(rest);
      const fullPath = parentPath === "/" ? "/" + rest : prefix + rest;
      const isDir = dirs.has(fullPath);
      nodes.push({ name: rest, path: fullPath, isDir, children: isDir ? getChildren(fullPath) : [] });
    }

    return nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return getChildren("/");
}

function FileTreeNode({ node, level }: { node: TreeNode; level: number }) {
  const { selectedFile, setSelectedFile } = useFileSystem();
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm transition-colors",
          selectedFile === node.path && "bg-blue-50 text-blue-600"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => (node.isDir ? setExpanded(!expanded) : setSelectedFile(node.path))}
      >
        {node.isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            )}
            {expanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileCode className="h-4 w-4 shrink-0 text-gray-400" />
          </>
        )}
        <span className="truncate text-gray-700">{node.name}</span>
      </div>
      {node.isDir && expanded && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const { files } = useFileSystem();
  const tree = buildTree(files);

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Folder className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No files yet</p>
        <p className="text-xs text-gray-400 mt-1">Files will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {tree.map((node) => (
          <FileTreeNode key={node.path} node={node} level={0} />
        ))}
      </div>
    </ScrollArea>
  );
}
