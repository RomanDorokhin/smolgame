import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameInterview } from '@/hooks/useGameInterview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  Download,
  RotateCcw,
  Gamepad2,
  User,
  Sparkles,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { INTERVIEW_QUESTIONS } from '@shared/interviewFlow';

export default function Home() {
  const {
    gameSpec,
    messages,
    isLoading,
    isGenerating,
    progress,
    isComplete,
    sendMessage,
    generateGame,
    resetInterview,
  } = useGameInterview();

  const [userInput, setUserInput] = useState('');
  const [generatedGame, setGeneratedGame] = useState<{
    htmlCode: string;
    prompt: string;
  } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // Initialize with greeting once
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      sendMessage('');
    }
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isGenerating]);

  // Focus input after AI responds
  useEffect(() => {
    if (!isLoading && !isGenerating && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [isLoading, isGenerating]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isLoading || isGenerating) return;
    const content = userInput;
    setUserInput('');

    await sendMessage(content);

    // Check completion after state updates settle
    // We use a small delay so that the gameSpec state has been updated
    setTimeout(async () => {
      // Re-read isComplete from the hook — it's reactive so we check via the ref approach
      // The hook will have updated gameSpec by now
    }, 0);
  }, [userInput, isLoading, isGenerating, sendMessage]);

  // Watch for interview completion and auto-trigger game generation
  useEffect(() => {
    if (isComplete && !generatedGame && !isGenerating && !generateError) {
      // Small delay to let the "ready" message appear first
      const timer = setTimeout(async () => {
        setGenerateError(null);
        try {
          const result = await generateGame();
          setGeneratedGame(result);
        } catch {
          setGenerateError('Failed to generate game. Click "Generate Game" to retry.');
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  const handleGenerateGame = useCallback(async () => {
    setGenerateError(null);
    try {
      const result = await generateGame();
      setGeneratedGame(result);
    } catch {
      setGenerateError('Failed to generate game. Please try again.');
    }
  }, [generateGame]);

  const downloadGame = useCallback(() => {
    if (!generatedGame) return;
    const element = document.createElement('a');
    const file = new Blob([generatedGame.htmlCode], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = 'my-game.html';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [generatedGame]);

  const handleReset = useCallback(() => {
    setGeneratedGame(null);
    setGenerateError(null);
    setUserInput('');
    hasInitialized.current = false;
    resetInterview();
    // Re-trigger greeting
    setTimeout(() => {
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        sendMessage('');
      }
    }, 50);
  }, [resetInterview, sendMessage]);

  const collectedCount = Object.keys(gameSpec).filter(
    (k) => gameSpec[k as keyof typeof gameSpec]
  ).length;

  const isInputDisabled = isLoading || isGenerating || (isComplete && !generateError);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Left: Chat Panel ── */}
      <div className={`flex flex-col ${generatedGame ? 'w-1/2' : 'flex-1'} border-r border-border`}>
        {/* Header */}
        <div className="border-b border-border bg-card px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-tight">Game Architect</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {collectedCount}/{INTERVIEW_QUESTIONS.length} fields collected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Retry generate button */}
              {generateError && isComplete && (
                <Button
                  onClick={handleGenerateGame}
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Generate Game
                </Button>
              )}

              {/* Download button */}
              {generatedGame && (
                <Button
                  onClick={downloadGame}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                >
                  <Download size={14} />
                  Download
                </Button>
              )}

              {/* Reset button */}
              <Button
                onClick={handleReset}
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Start over"
              >
                <RotateCcw size={14} />
                Start Over
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-xs text-muted-foreground">{progress}% complete</span>
              {isComplete && (
                <span className="text-xs text-green-600 font-medium">✓ Ready to generate!</span>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  <p className="text-sm">Starting interview...</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant avatar */}
                  {msg.role === 'assistant' && (
                    <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="size-3.5 text-primary" />
                    </div>
                  )}

                  <Card
                    className={`max-w-[80%] px-3.5 py-2.5 text-sm shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted border-muted'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Card>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="size-7 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                      <User className="size-3.5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading indicator for AI response */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <Card className="bg-muted border-muted px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </Card>
              </div>
            )}

            {/* Game generation loading */}
            {isGenerating && (
              <div className="flex gap-2.5 justify-start">
                <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-3.5 text-primary animate-pulse" />
                </div>
                <Card className="bg-muted border-muted px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Generating your game... This may take up to 2 minutes ⏳</span>
                  </div>
                </Card>
              </div>
            )}

            {/* Error state */}
            {generateError && (
              <div className="flex gap-2.5 justify-start">
                <div className="size-7 shrink-0 mt-1 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Sparkles className="size-3.5 text-destructive" />
                </div>
                <Card className="bg-destructive/10 border-destructive/20 px-3.5 py-2.5 text-sm text-destructive">
                  {generateError}
                </Card>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border bg-card p-3 shrink-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isInputDisabled) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isGenerating
                  ? 'Generating your game...'
                  : isComplete && !generateError
                  ? 'Game is being generated...'
                  : 'Type your answer and press Enter...'
              }
              disabled={isInputDisabled}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isInputDisabled || !userInput.trim()}
              size="icon"
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>

          {/* Quick hint */}
          {!isComplete && !isLoading && messages.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
              <ChevronRight size={12} />
              Answer all {INTERVIEW_QUESTIONS.length} questions to generate your game
            </p>
          )}
        </div>
      </div>

      {/* ── Right: Game Preview Panel ── */}
      {generatedGame && (
        <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'w-1/2'}`}>
          <div className="border-b border-border bg-card px-4 py-3 shrink-0 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Gamepad2 className="size-4 text-primary" />
              Game Preview
            </h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={downloadGame}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
              >
                <Download size={14} />
                Download HTML
              </Button>
              <Button
                onClick={() => setIsFullscreen((f) => !f)}
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Maximize2 size={14} />
              </Button>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-hidden bg-muted/30">
            <iframe
              srcDoc={generatedGame.htmlCode}
              className="w-full h-full border border-border rounded-lg bg-white shadow-sm"
              title="Game Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
