import { Card } from "@/components/ui/card";
import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to robustly extract text from ReactNode
function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join('');
  }
  if (React.isValidElement(node) && node.props && node.props.children) {
    return extractTextFromReactNode(node.props.children);
  }
  return '';
}

export type Message = {
  id: string;
  type: "user" | "ai" | "error";
  text: string;
};

function ChatArea({ 
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
  const BlockquoteWithCopy = useCallback(({ children, node, ...props }: any) => {
    const { messageId, blockquoteIndex } = props;
    const blockquoteKey = `${messageId}-bq-${blockquoteIndex}`;
    const isCopied = copiedPrompt === blockquoteKey;
    // Use robust text extraction for blockquotes
    const textToCopy = extractTextFromReactNode(children).trim();
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
              await navigator.clipboard.writeText(textToCopy);
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
  }, [copiedPrompt]);

  // Custom markdown components for ReactMarkdown
  const markdownComponents = useCallback((message: Message) => ({
    blockquote: (props: any) => {
      const blockquoteMatches = (message.text.match(/^ *>+/gm) || []);
      let blockquoteIndex = 0;
      if (blockquoteMatches.length > 1) {
        blockquoteIndex = blockquoteMatches.findIndex((_, i) => i === 0);
      }
      return <BlockquoteWithCopy {...props} messageId={message.id} blockquoteIndex={blockquoteIndex} />;
    },
    pre: ({ node, children, className, ...props }: any) => {
      let rawText = "";
      // Node-based extraction for code blocks
      if (node && node.children && node.children.length > 0 && node.children[0].tagName === 'code') {
        const codeNode = node.children[0];
        if (codeNode.children && codeNode.children.length > 0) {
          rawText = codeNode.children
            .filter((childNode: any) => childNode.type === 'text')
            .map((textNode: any) => textNode.value)
            .join('');
        }
      }
      // Fallback: extract from children using helper
      if (!rawText && children) {
        rawText = extractTextFromReactNode(children);
      }
      rawText = rawText.replace(/\n$/, "");
      return (
        <div className="relative group my-4 text-sm">
          <pre
            {...props}
            className={cn("p-4 rounded-lg overflow-x-auto bg-muted text-muted-foreground font-mono", className)}
          >
            {children}
          </pre>
          {rawText && (
            <button
              onClick={async () => {
                if (!rawText) return;
                try {
                  await navigator.clipboard.writeText(rawText);
                  setCopiedPrompt(rawText + message.id);
                  setTimeout(() => setCopiedPrompt(null), 2000);
                } catch (err) {
                  console.error('Failed to copy code: ', err);
                  alert('Failed to copy code.');
                }
              }}
              className="absolute top-2 right-2 p-1.5 rounded-md text-slate-500 hover:text-slate-700 \
                         dark:text-slate-400 dark:hover:text-slate-200 \
                         bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/90 dark:hover:bg-slate-700/90\n                         opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="Copy code"
            >
              {copiedPrompt === (rawText + message.id) ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      );
    },
    code({ node, inline, className, children, ...props }: any) {
      if (inline) {
        return (
          <code
            className={cn(
              "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-muted-foreground",
              className
            )}
            {...props}
          >
            {children}
          </code>
        );
      }
      return <code className={cn(className, 'font-mono')} {...props}>{children}</code>;
    }
  }), [BlockquoteWithCopy, copiedPrompt]);

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-6 py-4 space-y-4 sm:space-y-6 bg-background w-full max-w-[calc(100%-1rem)] sm:max-w-xl md:max-w-2xl mx-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} w-full`}
        >
          <Card
            className={`max-w-[85%] sm:max-w-xl w-fit p-3 sm:p-4 text-sm sm:text-base font-light rounded-2xl shadow-md relative ${
              message.type === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : message.type === "ai"
                ? `bg-background border border-border text-foreground break-words hyphens-auto 
                   prose prose-xs sm:prose-sm dark:prose-invert 
                   prose-blockquote:border-sky-400 prose-blockquote:dark:border-sky-600 
                   prose-blockquote:pl-3 sm:prose-blockquote:pl-4 prose-blockquote:py-0.5 
                   prose-blockquote:bg-slate-50 prose-blockquote:dark:bg-slate-800/50 
                   prose-blockquote:rounded-r-md prose-blockquote:not-italic
                   dark:prose-headings:text-neutral-50
                   dark:prose-p:text-neutral-50
                   dark:prose-li:text-neutral-50
                   dark:prose-strong:text-neutral-50
                   dark:prose-code:text-neutral-50
                   dark:prose-pre:text-neutral-50
                   dark:prose-ul:text-neutral-50
                   dark:prose-ol:text-neutral-50
                   dark:prose-hr:border-slate-700
                   dark:prose-table:text-neutral-50
                   dark:prose-th:bg-slate-900
                   dark:prose-th:text-neutral-50
                   dark:prose-td:text-neutral-50
                   dark:prose-thead:border-slate-700
                   dark:prose-tbody:border-slate-700
                   dark:prose-tr:border-slate-700
                   dark:prose-img:border-slate-700
                   dark:prose-video:border-slate-700
                   dark:prose-figure:text-neutral-50
                   dark:prose-figcaption:text-neutral-50`
                : "bg-destructive/20 text-destructive"
            }`}
          >
            {message.type === 'ai' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents(message)}
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
        <div className="flex justify-start w-full">
          <Card className="max-w-[85%] sm:max-w-xl w-fit p-3 sm:p-4 text-sm sm:text-base font-light rounded-2xl shadow-md bg-background border border-border animate-pulse">
            <span className="whitespace-pre-wrap">{streamingAI + (isLoading ? "\u258c" : "")}</span>
          </Card>
        </div>
      )}
      {isLoading && !streamingAI && messages.length > 0 && (
        <div className="flex justify-start w-full">
          <Card className="max-w-[85%] sm:max-w-xl w-fit p-3 sm:p-4 rounded-2xl border border-border shadow-md flex items-center gap-2">
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

export default React.memo(ChatArea); 