import { useState, useRef, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ChatMessage, Conversation, InterruptData, UsageBreakdown } from '@/lib/types';
import { sendMessage, resumeInterrupt } from '@/lib/apiClient';
import {
  updateConversationPreview,
  deriveTitle,
  derivePreview,
} from '@/lib/conversationStore';
import MessageBubble from './MessageBubble';
import InterruptPicker from './InterruptPicker';
import { Send, Loader2, Bot, Sparkles } from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation | null;
  userId: string;
  messages: ChatMessage[];
  // A real state setter (React's Dispatch), not a plain callback — every update
  // in this component must be computed against the LATEST state, not the
  // `messages` prop snapshot from when this component last rendered. A single
  // streamed turn calls this many times in a row (once per SSE event), and with
  // a plain (messages: ChatMessage[]) => void callback each call would recompute
  // from the same stale array, silently discarding every update but the last.
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  onConversationMetaUpdate: (id: string, title: string, preview: string) => void;
}

export default function ChatWindow({
  conversation,
  userId,
  messages,
  onMessagesChange,
  onConversationMetaUpdate,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Forwards the updater function itself to React's setState, so it always
  // runs against the true latest state rather than a snapshot from render time.
  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    onMessagesChange(updater);
  };

  const processStream = async (
    stream: AsyncGenerator<{
      type: string;
      content?: string;
      data?: InterruptData | UsageBreakdown;
      message?: string;
      thread_id?: string;
    }>,
    assistantMsgId: string,
    threadId: string,
  ): Promise<InterruptData | null> => {
    let fullContent = '';
    let toolContent = '';
    let interruptData: InterruptData | null = null;

    for await (const event of stream) {
      switch (event.type) {
        // The backend confirms which thread the turn ran on. For an existing
        // conversation this matches what we sent; it matters when the backend
        // mints a new thread id.
        case 'thread':
          break;

        case 'text':
          fullContent += event.content ?? '';
          updateMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: fullContent }
                : m,
            ),
          );
          break;

        case 'tool': {
          toolContent = event.content ?? '';
          const toolMessage: ChatMessage = {
            id: `tool-${Date.now()}-${Math.random()}`,
            conversation_id: threadId,
            role: 'tool',
            content: toolContent,
            interrupt_data: null,
            created_at: new Date().toISOString(),
          };
          // Insert right before the assistant placeholder by id, not by
          // position — assuming "the last message" is always the placeholder
          // breaks the moment anything else can append to the array mid-stream.
          updateMessages((prev) => {
            const index = prev.findIndex((m) => m.id === assistantMsgId);
            if (index === -1) return [...prev, toolMessage];
            return [...prev.slice(0, index), toolMessage, ...prev.slice(index)];
          });
          break;
        }

        case 'interrupt':
          interruptData = (event.data as InterruptData) ?? null;
          if (interruptData) {
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, interrupt_data: interruptData }
                  : m,
              ),
            );
          }
          break;

        case 'usage': {
          const usage = event.data as UsageBreakdown | undefined;
          if (usage) {
            updateMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, usage } : m)),
            );
          }
          break;
        }

        case 'error':
          fullContent += `\n\n**Error:** ${event.message}`;
          updateMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: fullContent } : m,
            ),
          );
          break;

        case 'done':
          break;
      }
    }

    // The backend records both sides of the exchange in agent_messages as it
    // runs, so there is nothing to persist from here — writing it again would
    // duplicate every message in the thread on reload.
    return interruptData;
  };

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || !conversation || isStreaming) return;

    const threadId = conversation.id;
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const now = new Date().toISOString();

    const userMessage: ChatMessage = {
      id: userMsgId,
      conversation_id: threadId,
      role: 'user',
      content: messageText,
      interrupt_data: null,
      created_at: now,
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      conversation_id: threadId,
      role: 'assistant',
      content: '',
      interrupt_data: null,
      created_at: new Date().toISOString(),
    };

    updateMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsStreaming(true);

    // Update conversation title/preview on first message
    if (messages.length === 0) {
      const title = deriveTitle(messageText);
      const preview = derivePreview(messageText);
      await updateConversationPreview(threadId, title, preview);
      onConversationMetaUpdate(threadId, title, preview);
    }

    try {
      const stream = sendMessage({ message: messageText, thread_id: threadId, user_id: userId });
      await processStream(stream, assistantMsgId, threadId);

      const preview = derivePreview(messageText);
      await updateConversationPreview(threadId, conversation.title, preview);

      // Either way the turn has stopped streaming: on a plain answer it's
      // finished, and on an interrupt the picker takes over — handleResume
      // starts streaming again when the user answers it.
      setIsStreaming(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `**Error:** ${errorMsg}` }
            : m,
        ),
      );
      setIsStreaming(false);
    }
  };

  const handleResume = async (selectedIds: string[]) => {
    if (!conversation || !messages.length) return;

    const threadId = conversation.id;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.interrupt_data) return;

    const interruptData = lastMessage.interrupt_data;
    const assistantMsgId = `assistant-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();

    const pickedLabels = selectedIds
      .map((id) => interruptData.options.find((o) => o.id === id)?.label ?? id)
      .join(', ');
    const summary =
      interruptData.kind === 'confirmation'
        ? `Chose: ${pickedLabels || 'none'}`
        : selectedIds.length === 0
          ? "Skipped — didn't pick any of the options"
          : `Picked: ${pickedLabels}`;

    // Replace the interrupted message with a tool summary of the pick, then add
    // a new assistant placeholder for the resumed stream. Matched by id, not
    // position — the interrupted message is wherever it is, not necessarily last.
    updateMessages((prev) => {
      const withoutInterrupt = prev.map((m) =>
        m.id === lastMessage.id
          ? {
              id: `tool-${Date.now()}`,
              conversation_id: threadId,
              role: 'tool' as const,
              content: summary,
              interrupt_data: null,
              created_at: now,
            }
          : m,
      );
      return [
        ...withoutInterrupt,
        {
          id: assistantMsgId,
          conversation_id: threadId,
          role: 'assistant' as const,
          content: '',
          interrupt_data: null,
          created_at: new Date().toISOString(),
        },
      ];
    });

    setIsStreaming(true);

    try {
      const stream = resumeInterrupt({
        thread_id: threadId,
        selection_id: interruptData.selection_id,
        selected_options: selectedIds,
      });

      // Loop: process stream, handle subsequent interrupts
      const nextInterrupt = await processStream(stream, assistantMsgId, threadId);

      if (!nextInterrupt) {
        setIsStreaming(false);
      }
      // If there IS a next interrupt, the new picker will render automatically
      // and the user can submit again, triggering another handleResume call.
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `**Error:** ${errorMsg}` }
            : m,
        ),
      );
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // Find the latest interrupt that hasn't been resolved yet
  const pendingInterrupt = messages.length > 0 ? messages[messages.length - 1]?.interrupt_data : null;
  const showInterruptPicker = pendingInterrupt !== null && !isStreaming;

  // Empty state
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Your AI Travel Agent</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Start a new conversation to plan flights, hotels, and activities for your next trip.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-teal-100 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Where to next?</h2>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              Ask me about flights, hotels, itineraries, or anything else for your trip.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
              {[
                'Plan a 5-day trip to Tokyo',
                'Find hotels in Paris under $200/night',
                'Book flights from JFK to London in October',
                'Create an itinerary for a weekend in Rome',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-600 text-left hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.id === messages[messages.length - 1]?.id && msg.interrupt_data && showInterruptPicker && (
                  <div className="mt-3 ml-11">
                    <InterruptPicker
                      data={msg.interrupt_data}
                      onSubmit={handleResume}
                    />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5">
          <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask about flights, hotels, activities…"
                rows={1}
                disabled={isStreaming}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none max-h-32 disabled:opacity-60"
                style={{ minHeight: '48px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Press Enter to send, Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
