import { tool } from "ai";
import { z } from "zod";
import { Files, fsViewFile, fsCreateFile, fsReplaceInFile, fsInsertInFile } from "@/lib/file-system";

export function buildStrReplaceTool(files: Files) {
  return tool({
    description: "View and edit files in the virtual file system.",
    parameters: z.object({
      command: z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
      path: z.string(),
      file_text: z.string().optional(),
      insert_line: z.number().optional(),
      new_str: z.string().optional(),
      old_str: z.string().optional(),
      view_range: z.array(z.number()).optional(),
    }),
    execute: async ({ command, path, file_text, insert_line, new_str, old_str, view_range }) => {
      switch (command) {
        case "view":
          return fsViewFile(files, path, view_range as [number, number] | undefined);
        case "create":
          return fsCreateFile(files, path, file_text ?? "");
        case "str_replace":
          return fsReplaceInFile(files, path, old_str ?? "", new_str ?? "");
        case "insert":
          return fsInsertInFile(files, path, insert_line ?? 0, new_str ?? "");
        case "undo_edit":
          return "Error: undo_edit not supported. Use str_replace to revert changes.";
      }
    },
  });
}
