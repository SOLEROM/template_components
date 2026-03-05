"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { Message } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextType {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: {
  children: ReactNode;
  projectId?: string;
  initialMessages?: Message[];
}) {
  const { files, handleToolCall } = useFileSystem();

  const { messages, input, handleInputChange, handleSubmit, status } = useAIChat({
    api: "/api/chat",
    initialMessages,
    body: { files, projectId },
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall);
    },
  });

  // Track anonymous work so it can be migrated when the user signs in
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, files);
    }
  }, [messages, files, projectId]);

  return (
    <ChatContext.Provider value={{ messages, input, handleInputChange, handleSubmit, status }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider");
  return context;
}
