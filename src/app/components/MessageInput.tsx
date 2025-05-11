import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef } from "react";
import { Send } from "lucide-react";

export default function MessageInput({ value, onChange, onSend, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      className="w-full flex items-end gap-2 bg-background border border-border rounded-xl shadow-lg px-4 py-3"
      onSubmit={e => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Send a message..."
        rows={1}
        className="flex-1 bg-transparent resize-none border-none focus:ring-0 focus:outline-none min-h-[40px] max-h-[120px] text-base font-light"
        style={{ boxShadow: 'none' }}
        autoFocus
      />
      <Button
        type="submit"
        size="icon"
        variant="default"
        className="rounded-full bg-black hover:bg-neutral-800 text-white disabled:opacity-50 disabled:hover:bg-black"
        disabled={disabled || !value.trim()}
        aria-label="Send"
      >
        <Send className="w-5 h-5" />
      </Button>
    </form>
  );
} 