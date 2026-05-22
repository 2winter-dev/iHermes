import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function getWebStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    return storage ? storage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) storage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function kvDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) storage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
