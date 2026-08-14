export type MessageRole = 'user' | 'assistant' | 'tool';

export interface InterruptOption {
  id: string;
  label: string;
  description?: string;
}

export type SelectionKind =
  | 'destination'
  | 'place'
  | 'event'
  | 'accommodation'
  | 'confirmation';

export interface InterruptData {
  reason: string;
  options: InterruptOption[];
  selection_id: string;
  /** What is being chosen, so the picker can label itself appropriately. */
  kind?: SelectionKind;
  /** The destination these options belong to, when there is one. */
  destination?: string | null;
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
  /** Omit to have the backend mint a new thread and return it in a `thread` event. */
  thread_id?: string;
  user_id?: string;
}

export interface ResumeInterruptRequest {
  thread_id: string;
  selection_id: string;
  /** Option ids the user picked. An empty array means they picked none. */
  selected_options: string[];
  user_id?: string;
}

export type StreamEvent =
  /** Sent first on /chat/send so a brand-new thread can be tracked immediately. */
  | { type: 'thread'; thread_id: string }
  | { type: 'text'; content: string }
  | { type: 'tool'; content: string }
  | { type: 'interrupt'; data: InterruptData }
  | { type: 'done' }
  | { type: 'error'; message: string };
