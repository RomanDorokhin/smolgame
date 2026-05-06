import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isGenerating, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
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
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-secondary/50 rounded-xl border border-border p-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Loading model..." : "Message OpenSmolGame Agent..."}
            disabled={disabled || isGenerating}
            className="min-h-[44px] max-h-[200px] bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-2.5 text-sm"
            rows={1}
          />
          {isGenerating ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStop}
              className="h-9 w-9 p-0 flex-shrink-0 rounded-lg"
            >
              <Square size={14} />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className="h-9 w-9 p-0 flex-shrink-0 rounded-lg"
            >
              {disabled ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          OpenSmolGame Agent runs entirely in your browser. Your messages never leave this device.
        </p>
      </div>
    </div>
  );
}
