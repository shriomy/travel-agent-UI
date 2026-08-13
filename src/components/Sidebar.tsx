import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Conversation } from '@/lib/types';
import {
  Plane,
  MessageSquarePlus,
  LogOut,
  Trash2,
  Search,
  MessageCircle,
  Loader2,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
  onDelete: (conversationId: string) => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = diffHrs / 24;

  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Sidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNewChat,
  onDelete,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.preview.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  return (
    <aside className="flex flex-col h-full w-full bg-white border-r border-slate-200">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-sm flex-shrink-0">
          <Plane className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Travel Agent</h1>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <MessageSquarePlus className="w-4.5 h-4.5 flex-shrink-0" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? 'bg-blue-50 text-blue-900'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <MessageCircle
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    activeId === conv.id ? 'text-blue-500' : 'text-slate-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-snug">{conv.title}</p>
                  {conv.preview && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{conv.preview}</p>
                  )}
                  <p className="text-[10px] text-slate-300 mt-1">{formatRelativeTime(conv.updated_at)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="border-t border-slate-100 p-3">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
