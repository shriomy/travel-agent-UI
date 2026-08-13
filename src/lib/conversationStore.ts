import { supabase } from './supabaseClient';
import type { Conversation, ChatMessage } from './types';

// --- Conversations ----------------------------------------------------------

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, title, preview, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createConversation(
  conversationId: string,
  userId: string,
  title = 'New conversation',
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title,
      preview: '',
    })
    .select('id, user_id, title, preview, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateConversationPreview(
  conversationId: string,
  title: string,
  preview: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title, preview, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

// --- Messages ---------------------------------------------------------------

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, interrupt_data, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function saveMessage(
  msg: Omit<ChatMessage, 'id' | 'created_at'>,
): Promise<void> {
  const { error } = await supabase.from('messages').insert(msg);
  if (error) throw error;
}

// --- Title generation -------------------------------------------------------

export function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40).trim() + '…';
}

export function derivePreview(content: string): string {
  const trimmed = content.trim().replace(/\n+/g, ' ');
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 80).trim() + '…';
}
