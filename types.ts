
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
