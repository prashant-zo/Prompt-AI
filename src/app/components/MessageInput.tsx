import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import React from "react";

function MessageInput({ value, onChange, onSend, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [value, adjustTextareaHeight]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }, [onSend]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSend();
  }, [onSend]);

  return (
    <form
      className="w-full flex items-end gap-2 bg-background border border-border rounded-xl shadow-lg px-2 sm:px-4 py-2 sm:py-3"
      onSubmit={handleSubmit}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Send a message..."
        rows={1}
        className="flex-1 bg-transparent resize-none border-none focus:ring-0 focus:outline-none min-h-[36px] sm:min-h-[40px] max-h-[120px] text-sm sm:text-base font-light overflow-y-auto"
        style={{ boxShadow: 'none' }}
        autoFocus
      />
      <Button
        type="submit"
        size="icon"
        variant="default"
        className="rounded-full bg-black hover:bg-neutral-800 text-white disabled:opacity-50 disabled:hover:bg-black h-8 w-8 sm:h-9 sm:w-9"
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>
    </form>
  );
}

export default React.memo(MessageInput); 