export type MessageRole = 'user' | 'assistant' | 'tool';

export interface InterruptOption {
  id: string;
  label: string;
  description?: string;
}

export interface InterruptData {
  reason: string;
  options: InterruptOption[];
  selection_id: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  interrupt_data: InterruptData | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
}

export interface SendMessageRequest {
  message: string;
  thread_id: string;
  user_id: string;
}

export interface ResumeInterruptRequest {
  thread_id: string;
  user_id: string;
  selection_id: string;
  selected_options: string[];
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool'; content: string }
  | { type: 'interrupt'; data: InterruptData }
  | { type: 'done' }
  | { type: 'error'; message: string };
