import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (val: string) => void;
}

export function ChatInput({ onSend, onStop, isGenerating, disabled, placeholder, value, onChange }: ChatInputProps) {
  const [localInput, setLocalInput] = useState("");
  const input = value !== undefined ? value : localInput;
  const setInput = onChange || setLocalInput;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative flex items-end gap-2 bg-secondary/30 rounded-[20px] border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all p-1.5 backdrop-blur-sm">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (disabled ? "Активируйте ключ выше..." : "Опиши свою игру...")}
          disabled={disabled || isGenerating}
          className="min-h-[44px] max-h-[200px] bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3 text-sm placeholder:opacity-40"
          rows={1}
        />
        {isGenerating ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onStop}
            className="h-10 w-10 p-0 flex-shrink-0 rounded-[14px] shadow-lg shadow-destructive/20"
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="h-10 w-10 p-0 flex-shrink-0 rounded-[14px] shadow-lg shadow-primary/20 transition-transform active:scale-90"
          >
            {disabled ? (
              <Loader2 size={16} className="animate-spin opacity-50" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
