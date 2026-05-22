import { ThemeMode } from '../theme/tokens';
import { kvGet, kvSet } from './kv';

const PREFERENCES_KEY = 'ihermes.preferences.v1';

export interface AppPreferences {
  themeMode: ThemeMode;
  animationsEnabled: boolean;
  defaultModel: string;
}

export const defaultPreferences: AppPreferences = {
  themeMode: 'warm',
  animationsEnabled: true,
  defaultModel: 'hermes-agent',
};

export async function loadPreferences(): Promise<AppPreferences> {
  const raw = await kvGet(PREFERENCES_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const themeMode = parsed.themeMode === 'soft' ? 'soft' : 'warm';
    const animationsEnabled = typeof parsed.animationsEnabled === 'boolean' ? parsed.animationsEnabled : true;
    const defaultModel = typeof parsed.defaultModel === 'string' && parsed.defaultModel.trim()
      ? parsed.defaultModel.trim()
      : defaultPreferences.defaultModel;

    return {
      themeMode,
      animationsEnabled,
      defaultModel,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await kvSet(PREFERENCES_KEY, JSON.stringify(preferences));
}
