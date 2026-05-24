import { ThemeMode } from '../theme/tokens';
import { kvGet, kvSet } from './kv';

const PREFERENCES_KEY = 'ihermes.preferences.v1';

export interface AppPreferences {
  themeMode: ThemeMode;
  animationsEnabled: boolean;
  streamEnabled: boolean;
  defaultModel: string;
  languagePreference: 'device' | 'zh' | 'en';
  showProcessDetails: boolean;
}

export const defaultPreferences: AppPreferences = {
  themeMode: 'warm',
  animationsEnabled: true,
  streamEnabled: true,
  defaultModel: 'hermes-agent',
  languagePreference: 'device',
  showProcessDetails: false,
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
    const streamEnabled = typeof parsed.streamEnabled === 'boolean' ? parsed.streamEnabled : true;
    const defaultModel = typeof parsed.defaultModel === 'string' && parsed.defaultModel.trim()
      ? parsed.defaultModel.trim()
      : defaultPreferences.defaultModel;
    const languagePreference =
      parsed.languagePreference === 'zh' || parsed.languagePreference === 'en' || parsed.languagePreference === 'device'
        ? parsed.languagePreference
        : defaultPreferences.languagePreference;
    const showProcessDetails =
      typeof parsed.showProcessDetails === 'boolean'
        ? parsed.showProcessDetails
        : defaultPreferences.showProcessDetails;

    return {
      themeMode,
      animationsEnabled,
      streamEnabled,
      defaultModel,
      languagePreference,
      showProcessDetails,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await kvSet(PREFERENCES_KEY, JSON.stringify(preferences));
}
