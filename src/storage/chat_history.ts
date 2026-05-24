import { kvGet, kvSet } from './kv';
import { Platform } from 'react-native';

const CHAT_HISTORY_KEY = 'ihermes.chat-history.v1';

export type StoredChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
};

export type ChatHistoryMap = Record<string, StoredChatMessage[]>;

export async function loadChatHistoryMap(): Promise<ChatHistoryMap> {
  // SecureStore has a small per-item size limit on native (roughly 2KB).
  // Chat history can exceed that quickly, so we keep native chat history in-memory only for now.
  if (Platform.OS !== 'web') return {};
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
  if (Platform.OS !== 'web') return;
  await kvSet(CHAT_HISTORY_KEY, JSON.stringify(map));
}
