import { tool } from "ai";
import { z } from "zod";
import { Files, fsRenameFile, fsDeleteFile } from "@/lib/file-system";

export function buildFileManagerTool(files: Files) {
  return tool({
    description: "Rename or delete files and directories in the virtual file system.",
    parameters: z.object({
      command: z.enum(["rename", "delete"]).describe("The operation to perform"),
      path: z.string().describe("Path to the file or directory"),
      new_path: z.string().optional().describe("New path (for rename only)"),
    }),
    execute: async ({ command, path, new_path }) => {
      if (command === "rename") {
        if (!new_path) return { success: false, error: "new_path is required for rename" };
        const success = fsRenameFile(files, path, new_path);
        return success
          ? { success: true, message: `Renamed ${path} to ${new_path}` }
          : { success: false, error: `Failed to rename ${path}` };
      }
      if (command === "delete") {
        const success = fsDeleteFile(files, path);
        return success
          ? { success: true, message: `Deleted ${path}` }
          : { success: false, error: `Failed to delete ${path}` };
      }
      return { success: false, error: "Invalid command" };
    },
  });
}
