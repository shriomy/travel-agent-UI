import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import type { Conversation, ChatMessage } from '@/lib/types';
import {
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchMessages,
} from '@/lib/conversationStore';
import { Menu, X, Loader2 } from 'lucide-react';

function TravelAgentApp() {
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSidebarLoading(true);
    fetchConversations(user.id)
      .then((convs) => {
        setConversations(convs);
        if (convs.length > 0 && !activeConversation) {
          setActiveConversation(convs[0]);
        }
      })
      .catch((err) => console.error('Failed to load conversations:', err))
      .finally(() => setSidebarLoading(false));
  }, [user]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    fetchMessages(activeConversation.id)
      .then((msgs) => setMessages(msgs))
      .catch((err) => console.error('Failed to load messages:', err));
  }, [activeConversation]);

  const handleNewChat = async () => {
    if (!user) return;
    const threadId = crypto.randomUUID();
    try {
      const conv = await createConversation(threadId, user.id);
      setConversations((prev) => [conv, ...prev]);
      setActiveConversation(conv);
      setMessages([]);
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);
      const updated = conversations.filter((c) => c.id !== conversationId);
      setConversations(updated);
      if (activeConversation?.id === conversationId) {
        setActiveConversation(updated[0] ?? null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleConversationMetaUpdate = (id: string, title: string, preview: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title, preview, updated_at: new Date().toISOString() } : c,
      ),
    );
    if (activeConversation?.id === id) {
      setActiveConversation((prev) =>
        prev ? { ...prev, title, preview, updated_at: new Date().toISOString() } : prev,
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeConversation?.id ?? null}
          loading={sidebarLoading}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteConversation}
        />
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-700 truncate">
            {activeConversation?.title ?? 'Travel Agent'}
          </span>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>

        <ChatWindow
          conversation={activeConversation}
          userId={user.id}
          messages={messages}
          onMessagesChange={setMessages}
          onConversationMetaUpdate={handleConversationMetaUpdate}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TravelAgentApp />
    </AuthProvider>
  );
}
