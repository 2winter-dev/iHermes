import { kvGet, kvSet } from './kv';

const CHAT_HISTORY_KEY = 'ihermes.chat-history.v1';

export type StoredChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
};

export type ChatHistoryMap = Record<string, StoredChatMessage[]>;

export async function loadChatHistoryMap(): Promise<ChatHistoryMap> {
  const raw = await kvGet(CHAT_HISTORY_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as ChatHistoryMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveChatHistoryMap(map: ChatHistoryMap): Promise<void> {
  await kvSet(CHAT_HISTORY_KEY, JSON.stringify(map));
}
