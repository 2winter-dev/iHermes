export type ThemeMode = 'warm' | 'soft';

export interface ThemeTokens {
  bg: string;
  blobTop: string;
  blobBottom: string;
  ink: string;
  inkStrong: string;
  inkSoft: string;
  border: string;
  borderSoft: string;
  card: string;
  cardWarm: string;
  cardTint: string;
  cardActive: string;
  inputBg: string;
  userBubble: string;
  assistantBubble: string;
  buttonPrimary: string;
  buttonDanger: string;
  online: string;
  offline: string;
  testing: string;
}

export const themes: Record<ThemeMode, ThemeTokens> = {
  warm: {
    bg: '#fff7ef',
    blobTop: '#ffe1bf',
    blobBottom: '#ffd4c8',
    ink: '#3b2618',
    inkStrong: '#4f2f1a',
    inkSoft: '#7a5c43',
    border: '#59422d',
    borderSoft: '#9b7c5f',
    card: '#fffdf8',
    cardWarm: '#fff2de',
    cardTint: '#fff8ea',
    cardActive: '#ffeecf',
    inputBg: '#fffcf6',
    userBubble: '#ffe4b8',
    assistantBubble: '#ffece7',
    buttonPrimary: '#ffbe66',
    buttonDanger: '#ff8f7d',
    online: '#16a34a',
    offline: '#dc2626',
    testing: '#d97706',
  },
  soft: {
    bg: '#f8fafc',
    blobTop: '#dbeafe',
    blobBottom: '#ffe4e6',
    ink: '#1f2937',
    inkStrong: '#111827',
    inkSoft: '#475569',
    border: '#334155',
    borderSoft: '#64748b',
    card: '#ffffff',
    cardWarm: '#f1f5f9',
    cardTint: '#f8fafc',
    cardActive: '#e2e8f0',
    inputBg: '#ffffff',
    userBubble: '#dbeafe',
    assistantBubble: '#fee2e2',
    buttonPrimary: '#93c5fd',
    buttonDanger: '#fda4af',
    online: '#16a34a',
    offline: '#dc2626',
    testing: '#d97706',
  },
};

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  round: 999,
};

export const borderWidths = {
  thick: 2,
};
