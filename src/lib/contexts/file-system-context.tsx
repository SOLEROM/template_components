"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  Files,
  normalizePath,
  fsCreateFile,
  fsReplaceInFile,
  fsInsertInFile,
  fsDeleteFile,
  fsRenameFile,
} from "@/lib/file-system";

interface FileSystemContextType {
  files: Files;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  createFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  getFileContent: (path: string) => string | null;
  handleToolCall: (toolCall: { toolName: string; args: any }) => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Files;
}) {
  const [files, setFiles] = useState<Files>(initialData ?? {});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Auto-select first file when nothing is selected
  useEffect(() => {
    if (selectedFile) return;
    const paths = Object.keys(files);
    if (paths.includes("/App.jsx")) {
      setSelectedFile("/App.jsx");
    } else if (paths.length > 0) {
      setSelectedFile(paths.sort()[0]);
    }
  }, [files, selectedFile]);

  const createFile = useCallback((path: string, content = "") => {
    setFiles((prev) => ({ ...prev, [normalizePath(path)]: content }));
  }, []);

  const updateFile = useCallback((path: string, content: string) => {
    setFiles((prev) => ({ ...prev, [normalizePath(path)]: content }));
  }, []);

  const deleteFile = useCallback((path: string) => {
    const p = normalizePath(path);
    setFiles((prev) => {
      const next = { ...prev };
      fsDeleteFile(next, p);
      return next;
    });
    setSelectedFile((sel) => (sel === p || sel?.startsWith(p + "/") ? null : sel));
  }, []);

  const renameFile = useCallback((oldPath: string, newPath: string) => {
    const oldP = normalizePath(oldPath);
    const newP = normalizePath(newPath);
    setFiles((prev) => {
      const next = { ...prev };
      fsRenameFile(next, oldP, newP);
      return next;
    });
    setSelectedFile((sel) => {
      if (sel === oldP) return newP;
      if (sel?.startsWith(oldP + "/")) return newP + sel.slice(oldP.length);
      return sel;
    });
  }, []);

  const getFileContent = useCallback(
    (path: string): string | null => files[normalizePath(path)] ?? null,
    [files]
  );

  const handleToolCall = useCallback(
    (toolCall: { toolName: string; args: any }) => {
      const { toolName, args } = toolCall;

      if (toolName === "str_replace_editor" && args) {
        const { command, path, file_text, old_str, new_str, insert_line } = args;
        setFiles((prev) => {
          const next = { ...prev };
          switch (command) {
            case "create":
              if (path !== undefined && file_text !== undefined)
                fsCreateFile(next, path, file_text);
              break;
            case "str_replace":
              if (path && old_str !== undefined && new_str !== undefined)
                fsReplaceInFile(next, path, old_str, new_str);
              break;
            case "insert":
              if (path && new_str !== undefined && insert_line !== undefined)
                fsInsertInFile(next, path, insert_line, new_str);
              break;
          }
          return next;
        });
      }

      if (toolName === "file_manager" && args) {
        const { command, path, new_path } = args;
        if (command === "rename" && path && new_path) renameFile(path, new_path);
        else if (command === "delete" && path) deleteFile(path);
      }
    },
    [renameFile, deleteFile]
  );

  return (
    <FileSystemContext.Provider
      value={{
        files,
        selectedFile,
        setSelectedFile,
        createFile,
        updateFile,
        deleteFile,
        renameFile,
        getFileContent,
        handleToolCall,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) throw new Error("useFileSystem must be used within a FileSystemProvider");
  return context;
}
