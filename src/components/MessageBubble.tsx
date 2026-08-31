import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/lib/types';
import { User, Bot, Wrench } from 'lucide-react';
import UsageBreakdown from './UsageBreakdown';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'tool') {
    return (
      <div className="flex items-center gap-2.5 py-1.5 px-1 animate-fadeIn">
        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-400 italic">{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className="animate-fadeIn">
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
              : 'bg-gradient-to-br from-teal-500 to-teal-600'
          }`}
        >
          {isUser ? (
            <User className="w-4.5 h-4.5 text-white" />
          ) : (
            <Bot className="w-4.5 h-4.5 text-white" />
          )}
        </div>

        <div
          className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-tr-md'
              : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-md'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {!isUser && message.usage && (
        <div className="ml-11 max-w-[85%] sm:max-w-[75%]">
          <UsageBreakdown usage={message.usage} />
        </div>
      )}
    </div>
  );
}
