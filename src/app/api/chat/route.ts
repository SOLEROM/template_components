import { Files } from "@/lib/file-system";
import { streamText, appendResponseMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const { messages, files, projectId }: { messages: any[]; files: Files; projectId?: string } =
    await req.json();

  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  // `files` is a plain object — tools mutate it directly during the session.
  // At onFinish, the mutated object reflects all AI file operations.
  const model = getLanguageModel();
  const isMock = !process.env.ANTHROPIC_API_KEY;

  const result = streamText({
    model,
    messages,
    maxTokens: 10_000,
    maxSteps: isMock ? 4 : 40,
    onError: (err: any) => console.error(err),
    tools: {
      str_replace_editor: buildStrReplaceTool(files),
      file_manager: buildFileManagerTool(files),
    },
    onFinish: async ({ response }) => {
      if (!projectId) return;
      try {
        const session = await getSession();
        if (!session) return;
        const allMessages = appendResponseMessages({
          messages: messages.filter((m) => m.role !== "system"),
          responseMessages: response.messages ?? [],
        });
        await prisma.project.update({
          where: { id: projectId, userId: session.userId },
          data: {
            messages: JSON.stringify(allMessages),
            data: JSON.stringify(files),
          },
        });
      } catch (error) {
        console.error("Failed to save project:", error);
      }
    },
  });

  return result.toDataStreamResponse();
}

export const maxDuration = 120;
