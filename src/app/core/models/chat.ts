export type MessageRole = 'bot' | 'user' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  ts: number;
}

export interface ChatCategoryOption {
  id: string;
  title: string;
}

export interface ChatState {
  question: string;
  category?: string;
  subcategoryId?: string;
  history: ChatMessage[];
  satisfied?: boolean;
}
