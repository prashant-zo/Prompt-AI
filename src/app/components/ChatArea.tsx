import { Card } from "@/components/ui/card";
import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

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
  // Track which blockquote was copied (by message id + blockquote index)
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Custom blockquote renderer for ReactMarkdown
  function BlockquoteWithCopy({ children, node, ...props }: any) {
    // Find a unique key for this blockquote: message id + blockquote index
    // We'll pass messageId and blockquoteIndex via props
    const { messageId, blockquoteIndex } = props;
    const blockquoteKey = `${messageId}-bq-${blockquoteIndex}`;
    const isCopied = copiedPrompt === blockquoteKey;
    // Get the text content of the blockquote
    const textToCopy = (children && children.length > 0 && typeof children[0] === 'string')
      ? children[0]
      : (Array.isArray(children) ? children.map(child => (typeof child === 'string' ? child : '')).join('') : '');
    return (
      <blockquote
        className="relative group"
        tabIndex={0}
        {...props}
      >
        {/* Copy button, only visible on hover/focus */}
        <button
          type="button"
          className="absolute top-1.5 right-2 p-1 rounded text-slate-400 dark:text-slate-500 hover:text-sky-500 dark:hover:text-sky-400 bg-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
          style={{ fontSize: 16 }}
          aria-label={isCopied ? 'Copied!' : 'Copy prompt'}
          onClick={async (e) => {
            e.stopPropagation();
            if (textToCopy) {
              await navigator.clipboard.writeText(textToCopy.trim());
              setCopiedPrompt(blockquoteKey);
              setTimeout(() => setCopiedPrompt(null), 1200);
            }
          }}
        >
          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        {children}
      </blockquote>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6 bg-background max-w-2xl mx-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
        >
          <Card
            className={`max-w-2xl w-fit p-4 text-base font-light rounded-2xl shadow-md relative ${
              message.type === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : message.type === "ai"
                ? `bg-background border border-border text-foreground break-words hyphens-auto 
                   prose prose-sm dark:prose-invert 
                   prose-blockquote:border-sky-400 prose-blockquote:dark:border-sky-600 
                   prose-blockquote:pl-4 prose-blockquote:py-0.5 
                   prose-blockquote:bg-slate-50 prose-blockquote:dark:bg-slate-800/50 
                   prose-blockquote:rounded-r-md prose-blockquote:not-italic`
                : "bg-destructive/20 text-destructive"
            }`}
          >
            {message.type === 'ai' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  blockquote({node, ...props}) {
                    // Find all blockquotes in this message, assign index
                    // We'll use a regex to count blockquotes up to this one
                    const blockquoteMatches = (message.text.match(/^ *>+/gm) || []);
                    // Find the index of this blockquote in the message
                    // This is a best-effort; if multiple blockquotes, index will increment
                    let blockquoteIndex = 0;
                    if (blockquoteMatches.length > 1) {
                      // Count how many blockquotes have appeared before this node
                      // Not perfect, but works for most simple cases
                      blockquoteIndex = blockquoteMatches.findIndex((_, i) => i === 0);
                    }
                    return (
                      <BlockquoteWithCopy {...props} messageId={message.id} blockquoteIndex={blockquoteIndex} />
                    );
                  }
                }}
              >
                {message.text}
              </ReactMarkdown>
            ) : (
              <span className="whitespace-pre-wrap break-words hyphens-auto">{message.text}</span>
            )}
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