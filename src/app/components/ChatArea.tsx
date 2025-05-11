import { Card } from "@/components/ui/card";
import React from "react";

export type Message = {
  id: string;
  type: "user" | "ai" | "error";
  text: string;
};

export default function ChatArea({ 
  messages, 
  streamingAI, 
  isLoading,
  chatEndRef,
  streamingMessageId 
}: {
  messages: Message[];
  streamingAI?: string | null;
  isLoading?: boolean;
  chatEndRef?: React.RefObject<HTMLDivElement>;
  streamingMessageId?: string | null;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 bg-background max-w-2xl mx-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
        >
          <Card
            className={`max-w-2xl w-fit p-4 text-base font-light rounded-2xl shadow-md ${
              message.type === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : message.type === "ai"
                ? "bg-background border border-border"
                : "bg-destructive/20 text-destructive"
            }`}
          >
            <span className="whitespace-pre-wrap">{message.text}</span>
          </Card>
        </div>
      ))}
      {streamingAI && (
        <div className="flex justify-start">
          <Card className="max-w-2xl w-fit p-4 text-base font-light rounded-2xl shadow-md bg-background border border-border animate-pulse">
            <span className="whitespace-pre-wrap">{streamingAI + (isLoading ? "\u258c" : "")}</span>
          </Card>
        </div>
      )}
      {isLoading && !streamingAI && (
        <div className="flex justify-start">
          <Card className="max-w-2xl w-fit p-4 rounded-2xl border border-border shadow-md flex items-center gap-2">
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-muted rounded-full animate-bounce delay-200" />
          </Card>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
} 