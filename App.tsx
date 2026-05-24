import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HermesApiClient } from './src/api/hermes/client';
import { HermesChatMessage, HermesConnection } from './src/api/hermes/types';
import { AnimatedMessageBubble } from './src/components/chat_bubble';
import { ActionButton, AnimatedCard, TabButton, ToolTextButton } from './src/components/ui';
import { APP_CONFIG } from './src/config/app_config';
import { LanguagePreference, resolveLanguage, SupportedLanguage, translations } from './src/i18n/translations';
import { ChatHistoryMap, loadChatHistoryMap, saveChatHistoryMap } from './src/storage/chat_history';
import { loadConnections, saveConnections } from './src/storage/connections';
import {
  AppPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from './src/storage/preferences';
import { styles, WEB_MAX_WIDTH } from './src/styles/app_styles';
import { ThemeMode, themes } from './src/theme/tokens';

type TabKey = 'instances' | 'settings';
type ConnectionState = 'idle' | 'testing' | 'online' | 'offline';
type ToolStepStatus = 'running' | 'success' | 'failed';

type ChatBubble = HermesChatMessage & {
  id: string;
  timestamp: string;
};

type ToolStep = {
  id: string;
  name: string;
  status: ToolStepStatus;
  startedAt: string;
  endedAt?: string;
};

type ProcessEntry = {
  id: string;
  text: string;
  timestamp: string;
};

type ThinkingStreamState = {
  raw: string;
  renderedContent: string;
  renderedReasoning: string;
};

type ToolEventPayload = {
  toolName?: string;
  detail?: string;
};

const CHAT_TIMEOUT_MS = 180_000;
const LONG_WAIT_REMINDER_SECONDS = 45;
const CHAT_DEBUG_PREFIX = '[iHermes chat]';

function chatDebug(...args: unknown[]) {
  try {
    if (typeof __DEV__ === 'undefined' || __DEV__) {
      console.log(CHAT_DEBUG_PREFIX, ...args);
    }
  } catch {
    // no-op
  }
}

interface ConnectionFormState {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const emptyForm = (defaultModel: string): ConnectionFormState => ({
  name: '',
  baseUrl: 'http://127.0.0.1:8642',
  apiKey: '',
  model: defaultModel,
});

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('instances');
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [instanceFormCollapsed, setInstanceFormCollapsed] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>(defaultPreferences.themeMode);
  const [animationsEnabled, setAnimationsEnabled] = useState(defaultPreferences.animationsEnabled);
  const [defaultModel, setDefaultModel] = useState(defaultPreferences.defaultModel);
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(
    defaultPreferences.languagePreference,
  );
  const [showProcessDetails, setShowProcessDetails] = useState(defaultPreferences.showProcessDetails);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(10);

  const theme = themes[themeMode];

  const [connections, setConnections] = useState<HermesConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionFormState>(emptyForm(defaultPreferences.defaultModel));
  const [testResult, setTestResult] = useState<string>(translations.zh.notTested);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [chatPhaseText, setChatPhaseText] = useState('');
  const [chatHistoryMap, setChatHistoryMap] = useState<ChatHistoryMap>({});
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [processEntries, setProcessEntries] = useState<ProcessEntry[]>([]);
  const [processEntriesByMessage, setProcessEntriesByMessage] = useState<Record<string, ProcessEntry[]>>({});
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [requestElapsedSeconds, setRequestElapsedSeconds] = useState(0);
  const [hermesVersion, setHermesVersion] = useState<string>(translations.zh.unknown);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const lastToolEventRef = useRef<string>('');
  const chatScrollRef = useRef<ScrollView | null>(null);
  const processEntriesRef = useRef<ProcessEntry[]>([]);

  const blobTopAnim = useRef(new Animated.Value(0)).current;
  const blobBottomAnim = useRef(new Animated.Value(0)).current;

  const selectedConnection = useMemo(
    () => connections.find((item) => item.id === selectedId) ?? null,
    [connections, selectedId],
  );
  const deviceLocale = useMemo(() => {
    const locale =
      Intl.DateTimeFormat().resolvedOptions().locale ||
      (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.language : '');
    return locale.toLowerCase();
  }, []);
  const resolvedLanguage: SupportedLanguage = useMemo(
    () => resolveLanguage(languagePreference, deviceLocale),
    [deviceLocale, languagePreference],
  );
  const t = translations[resolvedLanguage];
  const toggleOffColor = '#f1f5f9';

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') {
        return messages[i].content;
      }
    }
    return '';
  }, [messages]);

  const canRetry = useMemo(() => {
    if (!selectedConnection || isSending || messages.length < 2) {
      return false;
    }
    const last = messages[messages.length - 1];
    const previous = messages[messages.length - 2];
    return last.role === 'assistant' && previous.role === 'user';
  }, [isSending, messages, selectedConnection]);

  useEffect(() => {
    processEntriesRef.current = processEntries;
  }, [processEntries]);

  useEffect(() => {
    // Bootstrap: load local connections/preferences/history and auto-connect first instance.
    (async () => {
      const [savedConnections, savedPrefs, savedHistory] = await Promise.all([
        loadConnections(),
        loadPreferences(),
        loadChatHistoryMap(),
      ]);
      setConnections(savedConnections);
      setChatHistoryMap(savedHistory);
      if (savedConnections.length > 0) {
        const first = savedConnections[0];
        setSelectedId(first.id);
        setForm({
          id: first.id,
          name: first.name,
          baseUrl: first.baseUrl,
          apiKey: first.apiKey,
          model: first.model || savedPrefs.defaultModel,
        });
        setInstanceFormCollapsed(true);
        setMessages((savedHistory[first.id] as ChatBubble[] | undefined) ?? []);
        await connectAndSync({
          targetId: first.id,
          baseUrl: first.baseUrl,
          apiKey: first.apiKey,
          name: first.name,
          updateFormModel: true,
        });
      } else {
        setInstanceFormCollapsed(false);
        setMessages([]);
      }

      setThemeMode(savedPrefs.themeMode);
      setAnimationsEnabled(savedPrefs.animationsEnabled);
      setDefaultModel(savedPrefs.defaultModel);
      setLanguagePreference(savedPrefs.languagePreference);
      setShowProcessDetails(savedPrefs.showProcessDetails);
      setForm((prev) => (prev.id ? prev : { ...prev, model: savedPrefs.defaultModel }));
      setPrefsLoaded(true);
    })();


    // Monitor keyboard height changes.
    Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(10);
    });

    

  }, []);

  useEffect(() => {
    if (!prefsLoaded) {
      return;
    }
    // Persist user-facing preferences whenever they change.
    const next: AppPreferences = {
      themeMode,
      animationsEnabled,
      streamEnabled: true,
      defaultModel,
      languagePreference,
      showProcessDetails,
    };
    void savePreferences(next);
  }, [animationsEnabled, defaultModel, languagePreference, prefsLoaded, showProcessDetails, themeMode]);

  useEffect(() => {
    if (!isSending || !requestStartedAt) {
      setRequestElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setRequestElapsedSeconds(Math.max(0, Math.floor((Date.now() - requestStartedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isSending, requestStartedAt]);

  useEffect(() => {
    if (!selectedId) return;
    if (isSending) return;
    // Keep per-instance chat history in local storage for quick restoration.
    setChatHistoryMap((prev) => {
      const next: ChatHistoryMap = {
        ...prev,
        [selectedId]: messages.slice(-200).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      };
      void saveChatHistoryMap(next);
      return next;
    });
  }, [isSending, messages, selectedId]);

  useEffect(() => {
    if (testResult === translations.zh.notTested || testResult === translations.en.notTested) {
      setTestResult(t.notTested);
    }
    if (hermesVersion === translations.zh.unknown || hermesVersion === translations.en.unknown) {
      setHermesVersion(t.unknown);
    }
  }, [hermesVersion, t.notTested, t.unknown, testResult]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    // Inject static SEO metadata for web clients and social crawlers.

    const previousTitle = document.title;
    document.title = APP_CONFIG.seo.title;

    const ensuredNodes: Element[] = [];

    function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
      let meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, key);
        document.head.appendChild(meta);
        ensuredNodes.push(meta);
      }
      meta.setAttribute('content', content);
    }

    function upsertLink(rel: string, href: string) {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        document.head.appendChild(link);
        ensuredNodes.push(link);
      }
      link.setAttribute('href', href);
    }

    const origin = window.location.origin;
    const canonicalUrl = `${origin}/`;
    const imageUrl = `${origin}/hermes-logo.png`;

    upsertMeta('name', 'description', APP_CONFIG.seo.description);
    upsertMeta('name', 'keywords', APP_CONFIG.seo.keywords);
    upsertMeta('name', 'robots', 'index,follow,max-image-preview:large');
    upsertMeta('name', 'theme-color', '#EBC27A');

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'iHermes');
    upsertMeta('property', 'og:title', APP_CONFIG.seo.title);
    upsertMeta('property', 'og:description', APP_CONFIG.seo.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', imageUrl);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', APP_CONFIG.seo.title);
    upsertMeta('name', 'twitter:description', APP_CONFIG.seo.description);
    upsertMeta('name', 'twitter:image', imageUrl);

    upsertLink('canonical', canonicalUrl);

    const ldJsonId = 'ihermes-structured-data';
    let script = document.getElementById(ldJsonId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = ldJsonId;
      document.head.appendChild(script);
      ensuredNodes.push(script);
    }
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'iHermes',
          url: canonicalUrl,
          description: APP_CONFIG.seo.description,
          keywords: APP_CONFIG.seo.keywords,
          inLanguage: 'zh-CN',
        },
        {
          '@type': 'SoftwareApplication',
          name: 'iHermes',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Web, iOS, Android',
          description: APP_CONFIG.seo.description,
          keywords: APP_CONFIG.seo.keywords,
          url: canonicalUrl,
          image: imageUrl,
          softwareVersion: APP_CONFIG.appVersion,
          publisher: {
            '@type': 'Organization',
            name: 'iHermes',
          },
        },
        {
          '@type': 'Organization',
          name: 'iHermes',
          url: canonicalUrl,
          logo: imageUrl,
          sameAs: [APP_CONFIG.authorXhsUrl],
        },
      ],
    });

    return () => {
      document.title = previousTitle;
      ensuredNodes.forEach((node) => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const nav = window.navigator;
    const ua = nav.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      ((nav as any).standalone === true);

    setShowInstallHint(!isStandalone && isIos);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as any);
      setShowInstallHint(!isStandalone);
    };
    const onAppInstalled = () => {
      setShowInstallHint(false);
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!animationsEnabled) {
      blobTopAnim.stopAnimation();
      blobBottomAnim.stopAnimation();
      blobTopAnim.setValue(0);
      blobBottomAnim.setValue(0);
      return;
    }

    const topLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blobTopAnim, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(blobTopAnim, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );

    const bottomLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blobBottomAnim, {
          toValue: 1,
          duration: 6200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(blobBottomAnim, {
          toValue: 0,
          duration: 6200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );

    topLoop.start();
    bottomLoop.start();
    return () => {
      topLoop.stop();
      bottomLoop.stop();
    };
  }, [animationsEnabled, blobBottomAnim, blobTopAnim]);

  function patchForm<K extends keyof ConnectionFormState>(key: K, value: ConnectionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fillFormFromConnection(connection: HermesConnection) {
    setForm({
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      apiKey: connection.apiKey,
      model: connection.model || connection.apiModelName || defaultModel,
    });
  }

  async function persist(next: HermesConnection[]) {
    setConnections(next);
    await saveConnections(next);
  }

  async function handleSaveConnection() {
    const name = form.name.trim();
    const baseUrl = HermesApiClient.normalizeBaseUrl(form.baseUrl);
    const apiKey = form.apiKey.trim();
    const model = form.model.trim() || defaultModel;

    if (!name || !baseUrl || !apiKey) {
      Alert.alert(t.missingFieldsTitle, t.missingFieldsConnection);
      return;
    }

    const now = new Date().toISOString();
    if (form.id) {
      const updated = connections.map((item) =>
        item.id === form.id
          ? { ...item, name, baseUrl, apiKey, model, updatedAt: now }
          : item,
      );
      await persist(updated);
      setSelectedId(form.id);
      setConnectionState('idle');
      setTestResult(t.updatedHint);
      return;
    }

    const created: HermesConnection = {
      id: `${Date.now()}`,
      name,
      baseUrl,
      apiKey,
      model,
      createdAt: now,
      updatedAt: now,
    };

    const next = [created, ...connections];
    await persist(next);
    setSelectedId(created.id);
    setForm((prev) => ({ ...prev, id: created.id }));
    setConnectionState('idle');
    setTestResult(t.savedHint);
  }

  async function handleDeleteConnection() {
    if (!form.id) {
      return;
    }

    const next = connections.filter((item) => item.id !== form.id);
    await persist(next);
    const fallback = next[0] ?? null;
    setSelectedId(fallback?.id ?? null);
    setForm(
      fallback
        ? {
            id: fallback.id,
            name: fallback.name,
            baseUrl: fallback.baseUrl,
            apiKey: fallback.apiKey,
            model: fallback.model || fallback.apiModelName || defaultModel,
          }
        : emptyForm(defaultModel),
    );
    setInstanceFormCollapsed(next.length > 0);
    setMessages(fallback ? ((chatHistoryMap[fallback.id] as ChatBubble[] | undefined) ?? []) : []);
    setConnectionState('idle');
    setTestResult(t.notTested);
  }

  async function handleTestConnection() {
    const baseUrl = HermesApiClient.normalizeBaseUrl(form.baseUrl);
    const apiKey = form.apiKey.trim();
    if (!baseUrl || !apiKey) {
      Alert.alert(t.missingFieldsTitle, t.missingFieldsTest);
      return;
    }
    await connectAndSync({
      targetId: form.id,
      baseUrl,
      apiKey,
      name: form.name || t.currentInstance,
      updateFormModel: true,
    });
  }

  async function connectAndSync({
    targetId,
    baseUrl,
    apiKey,
    name,
    updateFormModel,
    preferredModel,
  }: {
    targetId?: string;
    baseUrl: string;
    apiKey: string;
    name: string;
    updateFormModel?: boolean;
    preferredModel?: string;
  }) {
    // Single source of truth for connection test + remote model/version sync.
    setIsTesting(true);
    setConnectionState('testing');
    try {
      const client = new HermesApiClient({ baseUrl, apiKey });
      await client.testConnection();
      const detailed = await client.getHealthDetailed().catch(() => undefined);
      const models = await client.listModels();
      const apiModelName = models[0]?.id || '';
      const resolvedModel =
        preferredModel?.trim() ||
        connections.find((c) => c.id === targetId)?.model?.trim() ||
        apiModelName ||
        defaultModel;

      if (updateFormModel) {
        setForm((prev) => ({ ...prev, model: resolvedModel }));
      }

      if (targetId) {
        const now = new Date().toISOString();
        setConnections((prev) => {
          const next = prev.map((item) =>
            item.id === targetId
              ? { ...item, model: resolvedModel, apiModelName: apiModelName || item.apiModelName, updatedAt: now }
              : item,
          );
          void saveConnections(next);
          return next;
        });
      }

      const version = extractHermesVersion(detailed);
      if (version) {
        setHermesVersion(version);
      }

      setConnectionState('online');
      setTestResult(
        `${name} ${t.connectSuccess}: ${resolvedModel}${apiModelName ? `, ${t.apiModel}: ${apiModelName}` : ''}`,
      );
    } catch (error) {
      setConnectionState('offline');
      setTestResult(`${name} ${t.connectFailed}: ${toErrorMessage(error)}`);
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSelectConnection(item: HermesConnection) {
    setSelectedId(item.id);
    fillFormFromConnection(item);
    setMessages((chatHistoryMap[item.id] as ChatBubble[] | undefined) ?? []);
    setInstanceFormCollapsed(true);
    await connectAndSync({
      targetId: item.id,
      baseUrl: item.baseUrl,
      apiKey: item.apiKey,
      name: item.name,
      updateFormModel: true,
    });
  }

  async function handleRefreshSelectedConnection() {
    const current =
      connections.find((item) => item.id === selectedId) ||
      (form.baseUrl && form.apiKey
        ? ({
            id: form.id || 'temp',
            name: form.name || t.currentInstance,
            baseUrl: form.baseUrl,
            apiKey: form.apiKey,
            model: form.model,
            createdAt: '',
            updatedAt: '',
          } as HermesConnection)
        : null);
    if (!current) {
      Alert.alert(t.noInstanceSelectedTitle, t.noInstanceSelectedDesc);
      return;
    }
    await connectAndSync({
      targetId: current.id === 'temp' ? undefined : current.id,
      baseUrl: current.baseUrl,
      apiKey: current.apiKey,
      name: current.name,
      updateFormModel: true,
    });
  }

  async function requestAssistantReply(history: ChatBubble[]) {
    if (!selectedConnection) {
      return;
    }
    chatDebug('requestAssistantReply.start', {
      baseUrl: selectedConnection.baseUrl,
      model: selectedConnection.model || defaultModel,
      showProcessDetails,
      historyCount: history.length,
    });

    const placeholderId = `${Date.now()}-a`;
    const placeholder: ChatBubble = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);
    activeAssistantIdRef.current = placeholderId;
    setChatPhaseText(t.assistantThinking);
    setToolSteps([]);
    setProcessEntries([]);
    processEntriesRef.current = [];
    setProcessEntriesByMessage((prev) => {
      const next = { ...prev };
      delete next[placeholderId];
      return next;
    });
    setRequestStartedAt(Date.now());

    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    const thinkingState: ThinkingStreamState = {
      raw: '',
      renderedContent: '',
      renderedReasoning: '',
    };
    try {
      const requestExtras = showProcessDetails
        ? {
            include_reasoning: true,
            reasoning: true,
            thinking: true,
            stream_options: {
              include_usage: true,
              include_reasoning: true,
            },
          }
        : {
            stream_options: { include_usage: true },
          };
      await streamChatCompletion({
        baseUrl: selectedConnection.baseUrl,
        apiKey: selectedConnection.apiKey,
        model: selectedConnection.model || defaultModel,
        messages: history.map((msg) => ({ role: msg.role, content: msg.content })),
        extraRequestBody: requestExtras,
        onDelta: (delta) => {
          if (!delta) return;
          const extracted = consumeThinkingDelta(thinkingState, delta);
          if (extracted.reasoningDelta && showProcessDetails) {
            chatDebug('stream.reasoning.inline', { chars: extracted.reasoningDelta.length });
            pushProcessEntry(extracted.reasoningDelta);
          }
          if (!extracted.contentDelta) return;
          chatDebug('stream.delta', { chars: extracted.contentDelta.length });
          setChatPhaseText(t.assistantReplying);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId ? { ...msg, content: msg.content + extracted.contentDelta } : msg,
            ),
          );
        },
        onReasoning: (reasoning) => {
          if (!showProcessDetails || !reasoning.trim()) return;
          chatDebug('stream.reasoning', { chars: reasoning.length });
          pushProcessEntry(reasoning);
        },
            onToolEvent: (toolEvent) => {
              const normalizedToolName = (toolEvent?.toolName || '').trim();
              const detail = (toolEvent?.detail || '').trim();
              const dedupeKey = `${normalizedToolName}::${detail.slice(0, 140)}`;
              if (lastToolEventRef.current === dedupeKey) {
                return;
              }
              lastToolEventRef.current = dedupeKey;
              chatDebug('stream.tool_event', { toolName: normalizedToolName, detailChars: detail.length });
              pushToolStep(normalizedToolName);
              if (showProcessDetails) {
                if (normalizedToolName) {
                  pushProcessEntry(`tool.${normalizedToolName}`);
                } else {
                  pushProcessEntry(t.callingToolFallback);
                }
                if (detail) {
                  pushProcessEntry(detail);
                }
              }
              setChatPhaseText(normalizedToolName ? `${t.callingTool} ${normalizedToolName}` : t.callingToolFallback);
            },
        timeoutMs: CHAT_TIMEOUT_MS,
        signal: abortController.signal,
      });
      chatDebug('stream.end');

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === placeholderId && !msg.content.trim() ? { ...msg, content: t.emptyResponse } : msg,
        ),
      );
      completeRunningToolSteps(true);
      setChatPhaseText('');
    } catch (error) {
      chatDebug('requestAssistantReply.error', toErrorMessage(error));
      if (isAbortError(error)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId && !msg.content.trim() ? { ...msg, content: t.requestSuspended } : msg,
          ),
        );
        completeRunningToolSteps(false);
      } else {
        const errorText = `${t.requestFailed}: ${toErrorMessage(error)}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId ? { ...msg, content: msg.content.trim() ? msg.content : errorText } : msg,
          ),
        );
        completeRunningToolSteps(false);
      }
      setChatPhaseText('');
      return;
    } finally {
      const finalProcessEntries = processEntriesRef.current;
      if (finalProcessEntries.length > 0) {
        setProcessEntriesByMessage((prev) => ({
          ...prev,
          [placeholderId]: finalProcessEntries,
        }));
      }
      chatDebug('requestAssistantReply.finally');
      setRequestStartedAt(null);
      requestAbortRef.current = null;
      activeAssistantIdRef.current = null;
      lastToolEventRef.current = '';
    }
  }

  async function handleSendMessage() {
    const prompt = chatInput.trim();
    if (!selectedConnection || !prompt) {
      return;
    }

    setIsSending(true);
    chatDebug('handleSendMessage', { promptChars: prompt.length });
    setChatInput('');

    const userMessage: ChatBubble = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      await requestAssistantReply(nextMessages);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      const errorMessage: ChatBubble = {
        id: `${Date.now()}-e`,
        role: 'assistant',
        content: `${t.requestFailed}: ${toErrorMessage(error)}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      completeRunningToolSteps(false);
      setChatPhaseText('');
    } finally {
      setIsSending(false);
    }
  }

  async function handleRetryLast() {
    if (!canRetry) {
      return;
    }

    setIsSending(true);
    const truncated = messages.slice(0, -1);
    setMessages(truncated);
    setProcessEntriesByMessage((prev) => {
      const valid = new Set(truncated.map((item) => item.id));
      const next: Record<string, ProcessEntry[]> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (valid.has(key)) next[key] = value;
      }
      return next;
    });
    try {
      await requestAssistantReply(truncated);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      const errorMessage: ChatBubble = {
        id: `${Date.now()}-e`,
        role: 'assistant',
        content: `${t.retryFailed}: ${toErrorMessage(error)}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      completeRunningToolSteps(false);
      setChatPhaseText('');
    } finally {
      setIsSending(false);
    }
  }

  function pushProcessEntry(text: string) {
    if (!text.trim()) return;
    const now = new Date().toISOString();
    setProcessEntries((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: now,
      },
    ]);
  }

  async function handleCopyLastReply() {
    if (!lastAssistantText) {
      Alert.alert(t.noCopyContentTitle, t.noCopyContentDesc);
      return;
    }
    await Clipboard.setStringAsync(lastAssistantText);
    Alert.alert(t.copiedTitle, t.copiedReplyDesc);
  }

  function handleClearChat() {
    setMessages([]);
    setToolSteps([]);
    setProcessEntries([]);
    processEntriesRef.current = [];
    setProcessEntriesByMessage({});
    setChatPhaseText('');
  }

  async function copyBubbleContent(content: string) {
    await Clipboard.setStringAsync(content);
    Alert.alert(t.copiedTitle, t.copiedBubbleDesc);
  }

  async function handleShareRepository() {
    try {
      await Share.share({
        message: APP_CONFIG.openSourceRepoUrl,
        url: APP_CONFIG.openSourceRepoUrl,
        title: t.viewRepository,
      });
    } catch (error) {
      Alert.alert(t.shareFailedTitle, `${t.shareFailedDesc}: ${toErrorMessage(error)}`);
    }
  }

  function pushToolStep(name?: string) {
    const stepName = name?.trim();
    const finalName = stepName || t.callingToolFallback;
    // Mark previous running step as complete before opening the next step.
    setToolSteps((prev) => {
      const next = prev.map((item) =>
        item.status === 'running'
          ? { ...item, status: 'success' as ToolStepStatus, endedAt: new Date().toISOString() }
          : item,
      );
      return [
        ...next,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: finalName,
          status: 'running' as ToolStepStatus,
          startedAt: new Date().toISOString(),
        },
      ];
    });
  }

  function completeRunningToolSteps(success: boolean) {
    setToolSteps((prev) =>
      prev.map((item) =>
        item.status === 'running'
          ? {
              ...item,
              status: (success ? 'success' : 'failed') as ToolStepStatus,
              endedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function handleSuspendRequest() {
    if (!isSending) return;
    requestAbortRef.current?.abort();
  }

  function handleReloadSession() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    Alert.alert(t.reload, t.longWaitHint);
  }

  function handleScrollToTop() {
    chatScrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleScrollToBottom() {
    chatScrollRef.current?.scrollToEnd({ animated: true });
  }

  async function handleInstallPwa() {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice?.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setShowInstallHint(false);
    }
    setInstallPromptEvent(null);
  }

  const topBlobTransform = {
    transform: [
      {
        translateY: blobTopAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
      },
      {
        scale: blobTopAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
      },
    ],
  };

  const bottomBlobTransform = {
    transform: [
      {
        translateY: blobBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
      },
      {
        scale: blobBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
      },
    ],
  };

  const statusColor =
    connectionState === 'online'
      ? theme.online
      : connectionState === 'offline'
      ? theme.offline
      : connectionState === 'testing'
      ? theme.testing
      : theme.inkSoft;

  const statusLabel =
    connectionState === 'online'
      ? t.statusOnline
      : connectionState === 'offline'
      ? t.statusOffline
      : connectionState === 'testing'
      ? t.statusTesting
      : t.statusUnchecked;
  const chatEnabled = connectionState === 'online' && !!selectedConnection;
  const showFloatingBar = !(Platform.OS === 'web' && showChatSheet);

  useEffect(() => {
    if (!chatEnabled && showChatSheet) {
      setShowChatSheet(false);
    }
  }, [chatEnabled, showChatSheet]);

  return (
    <View
      style={[
        styles.safeArea,
        Platform.OS === 'web' ? styles.safeAreaWeb : null,
        { backgroundColor: theme.bg },
      ]}
    >
      <StatusBar style="dark" />
      <Animated.View
        style={[
          styles.bgBlobTop,
          { backgroundColor: theme.blobTop },
          animationsEnabled ? topBlobTransform : null,
        ]}
      />
      <Animated.View
        style={[
          styles.bgBlobBottom,
          { backgroundColor: theme.blobBottom },
          animationsEnabled ? bottomBlobTransform : null,
        ]}
      />

      <View style={styles.webStage}>
        <View style={styles.mainWrap}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={{...styles.container}}>
            <AnimatedCard delay={0} enabled={animationsEnabled}>
              <View
                style={[styles.heroCard, { backgroundColor: theme.cardWarm, borderColor: theme.border }]}
              >
                <Image
                  source={require('./assets/hermes-logo.png')}
                  style={[styles.logo, { borderColor: theme.border }]}
                />
                <View style={styles.heroTextWrap}>
                  <Text
                    style={[styles.title, { color: theme.inkStrong }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    iHermes Chat
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.inkSoft }]}>{t.heroSubtitle}</Text>
                </View>
                <Pressable style={styles.heroStatusWrap} onPress={() => void handleRefreshSelectedConnection()}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: theme.border }]} />
                  <Text style={[styles.heroStatusText, { color: theme.inkSoft }]}>{statusLabel}</Text>
                </Pressable>
              </View>
            </AnimatedCard>

            {activeTab === 'instances' ? (
              <>
                <AnimatedCard delay={80} enabled={animationsEnabled}>
                  <View
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.savedInstances}</Text>
                    {connections.length === 0 ? (
                      <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.noSavedInstances}</Text>
                    ) : (
                      <FlatList
                        data={connections}
                        scrollEnabled={false}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => {
                          const active = item.id === selectedId;
                          return (
                            <View
                              style={[
                                styles.connectionItem,
                                {
                                  borderColor: active ? theme.border : theme.borderSoft,
                                  backgroundColor: active ? theme.cardActive : theme.cardTint,
                                },
                              ]}
                            >
                              <Pressable onPress={() => void handleSelectConnection(item)} style={styles.connectionMainArea}>
                                <Text style={[styles.connectionName, { color: theme.ink }]}>{item.name}</Text>
                                <Text style={[styles.connectionMeta, { color: theme.inkSoft }]}>{item.baseUrl}</Text>
                                <Text style={[styles.connectionMeta, { color: theme.inkSoft }]}>{t.modelLabel}: {item.model || defaultModel}</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setSelectedId(item.id);
                                  fillFormFromConnection(item);
                                  setInstanceFormCollapsed(false);
                                }}
                                style={styles.connectionEditButton}
                              >
                                <Text style={[styles.connectionEditText, { color: theme.inkStrong }]}>{t.edit}</Text>
                              </Pressable>
                            </View>
                          );
                        }}
                      />
                    )}
                  </View>
                </AnimatedCard>

                <AnimatedCard delay={160} enabled={animationsEnabled}>
                  <View
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, paddingBottom: keyboardHeight }]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.instanceManagement}</Text>
                      <View style={styles.headerActionsRow}>
                        <Pressable onPress={() => setInstanceFormCollapsed((v) => !v)}>
                          <Text style={[styles.foldToggleText, { color: theme.inkStrong }]}>
                            {instanceFormCollapsed ? t.expand : t.collapse}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    {!instanceFormCollapsed ? (
                      <>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              borderColor: theme.borderSoft,
                              backgroundColor: theme.inputBg,
                              color: theme.ink,
                            },
                          ]}
                          placeholder={t.namePlaceholder}
                          placeholderTextColor={theme.inkSoft}
                          value={form.name}
                          onChangeText={(value) => patchForm('name', value)}
                        />
                        <TextInput
                          style={[
                            styles.input,
                            {
                              borderColor: theme.borderSoft,
                              backgroundColor: theme.inputBg,
                              color: theme.ink,
                            },
                          ]}
                          placeholder={t.urlPlaceholder}
                          placeholderTextColor={theme.inkSoft}
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={form.baseUrl}
                          onChangeText={(value) => patchForm('baseUrl', value)}
                        />
                        <TextInput
                          style={[
                            styles.input,
                            {
                              borderColor: theme.borderSoft,
                              backgroundColor: theme.inputBg,
                              color: theme.ink,
                            },
                          ]}
                          placeholder={t.apiKeyPlaceholder}
                          placeholderTextColor={theme.inkSoft}
                          autoCapitalize="none"
                          autoCorrect={false}
                          // secureTextEntry
                          value={form.apiKey}
                          onChangeText={(value) => patchForm('apiKey', value)}
                        />
                        <Text style={[styles.hint, { color: theme.inkSoft }]}>
                          {t.modelAutoHint}: {form.model || defaultModel}
                        </Text>

                        <View style={styles.row}>
                          <ActionButton
                            label={form.id ? t.updateSave : t.save}
                            onPress={handleSaveConnection}
                            color={theme.buttonPrimary}
                            borderColor={theme.border}
                            textColor={theme.ink}
                          />
                          <ActionButton
                            label={isTesting ? t.testingLabel : t.testConnection}
                            disabled={isTesting}
                            onPress={handleTestConnection}
                            color={theme.buttonPrimary}
                            borderColor={theme.border}
                            textColor={theme.ink}
                          />
                          <ActionButton
                            label={t.delete}
                            disabled={!form.id}
                            onPress={handleDeleteConnection}
                            color={theme.buttonDanger}
                            borderColor={theme.border}
                            textColor={theme.ink}
                          />
                        </View>
                        <Text style={[styles.hint, { color: theme.inkSoft }]}>{testResult}</Text>
                      </>
                    ) : (
                      <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.collapsedHint}</Text>
                    )}
                  </View>
                </AnimatedCard>
              </>
            ) : (
              <>
                <AnimatedCard delay={80} enabled={animationsEnabled}>
                  <View style={[styles.card, { backgroundColor: '#ffffff', borderColor: theme.border }]}> 
                    <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.settings}</Text>

                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.theme}</Text>
                    <View style={styles.row}>
                      <ActionButton
                        label={t.themeWarm}
                        onPress={() => setThemeMode('warm')}
                        color={themeMode === 'warm' ? theme.buttonPrimary : '#f1f5f9'}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                      <ActionButton
                        label={t.themeSoft}
                        onPress={() => setThemeMode('soft')}
                        color={themeMode === 'soft' ? theme.buttonPrimary : '#f1f5f9'}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                    </View>

                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.language}</Text>
                    <View style={styles.row}>
                      <ActionButton
                        label={t.langDevice}
                        onPress={() => setLanguagePreference('device')}
                        color={languagePreference === 'device' ? theme.buttonPrimary : '#f1f5f9'}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                      <ActionButton
                        label={t.langChinese}
                        onPress={() => setLanguagePreference('zh')}
                        color={languagePreference === 'zh' ? theme.buttonPrimary : '#f1f5f9'}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                      <ActionButton
                        label={t.langEnglish}
                        onPress={() => setLanguagePreference('en')}
                        color={languagePreference === 'en' ? theme.buttonPrimary : '#f1f5f9'}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                    </View>

                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.other}</Text>
                    <View style={styles.row}>
                      <ActionButton
                        label={`${t.animations} ${animationsEnabled ? t.on : t.off}`}
                        onPress={() => setAnimationsEnabled((v) => !v)}
                        color={animationsEnabled ? theme.buttonPrimary : toggleOffColor}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                      <ActionButton
                        label={`${t.processEvents} ${showProcessDetails ? t.on : t.off}`}
                        onPress={() => setShowProcessDetails((v) => !v)}
                        color={showProcessDetails ? theme.buttonPrimary : toggleOffColor}
                        borderColor={theme.border}
                        textColor={theme.ink}
                      />
                    </View>

                  </View>
                </AnimatedCard>

                <AnimatedCard delay={120} enabled={animationsEnabled}>
                  <View style={[styles.card, { backgroundColor: '#ffffff', borderColor: theme.border }]}> 
                    <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.versionInfo}</Text>
                    <View style={styles.versionRow}>
                      <View style={styles.row}>
                        <Text style={[styles.hint, { color: theme.inkSoft }]}>
                          {t.hermesVersion}: {selectedConnection?.model || defaultModel}
                        </Text>
                        <ActionButton
                          label={`${t.shareRepository} ${APP_CONFIG.appVersion}`}
                          onPress={() => void handleShareRepository()}
                          color={theme.buttonPrimary}
                          borderColor={theme.border}
                          textColor={theme.ink}
                        />
                      </View>
                    </View>
                  </View>
                </AnimatedCard>

                <AnimatedCard delay={160} enabled={animationsEnabled}>
                  <View style={[styles.card, { backgroundColor: '#ffffff', borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.help}</Text>
                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.authorContact}</Text>
                    <Pressable
                      style={[
                        styles.contactLinkButton,
                        { borderColor: theme.borderSoft, backgroundColor: theme.inputBg },
                      ]}
                      onPress={() => void Linking.openURL(APP_CONFIG.authorXhsUrl)}
                    >
                      <Text style={[styles.contactLinkText, { color: theme.inkStrong }]}>Xiaohongshu: 2winter</Text>
                    </Pressable>
                    {Platform.OS === 'web' && showInstallHint ? (
                      <>
                        <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.installPwa}</Text>
                        {installPromptEvent ? (
                          <View style={styles.row}>
                            <ActionButton
                              label={t.installIhermes}
                              onPress={() => void handleInstallPwa()}
                              color={theme.buttonPrimary}
                              borderColor={theme.border}
                              textColor={theme.ink}
                            />
                          </View>
                        ) : (
                          <View style={styles.helpBox}>
                            <Text style={[styles.helpText, { color: theme.inkSoft }]}>
                              {t.iosPwaHint}
                            </Text>
                            <Text style={[styles.helpText, { color: theme.inkSoft }]}>
                              {t.androidPwaHint}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : null}
                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.howToApiKey}</Text>
                    <View style={styles.helpBox}>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp1}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp2}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp3}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp4}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp5}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.apiHelp6}</Text>
                    </View>
                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.faq}</Text>
                    <View style={styles.helpBox}>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqQ1}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqA1}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqQ2}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqA2}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqQ3}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqA3}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqQ4}</Text>
                      <Text style={[styles.helpText, { color: theme.inkSoft }]}>{t.faqA4}</Text>
                    </View>
                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.openSource}</Text>
                    <Pressable
                      style={[
                        styles.contactLinkButton,
                        { borderColor: theme.borderSoft, backgroundColor: theme.inputBg },
                      ]}
                      onPress={() => void Linking.openURL(APP_CONFIG.openSourceRepoUrl)}
                    >
                      <Text style={[styles.contactLinkText, { color: theme.inkStrong }]}>{t.viewRepository}</Text>
                    </Pressable>
                    {Platform.OS === 'web' ? (
                      <>
                        <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.apkDownload}</Text>
                        <Pressable
                          style={[
                            styles.contactLinkButton,
                            { borderColor: theme.borderSoft, backgroundColor: theme.inputBg },
                          ]}
                          onPress={() => void Linking.openURL(APP_CONFIG.androidApkDownloadUrl)}
                        >
                          <Text style={[styles.contactLinkText, { color: theme.inkStrong }]}>{t.downloadAndroidApk}</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </AnimatedCard>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {showFloatingBar ? (
          <View style={styles.floatingBarWrap}>
            <View style={[styles.floatingBar, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <TabButton
                active={activeTab === 'instances'}
                label={t.tabInstances}
                icon="server-outline"
                onPress={() => setActiveTab('instances')}
                color={theme.inkStrong}
                enabled={animationsEnabled}
              />
              <View style={styles.chatButtonPlaceholder} />
              <TabButton
                active={activeTab === 'settings'}
                label={t.tabSettings}
                icon="settings-outline"
                onPress={() => setActiveTab('settings')}
                color={theme.inkStrong}
                enabled={animationsEnabled}
              />
            </View>

            <Pressable
              style={[
                styles.chatFab,
                !chatEnabled ? styles.chatFabDisabled : null,
                {
                  backgroundColor: chatEnabled ? theme.buttonPrimary : theme.cardTint,
                  borderColor: chatEnabled ? theme.border : theme.borderSoft,
                },
              ]}
              disabled={!chatEnabled}
              onPress={() => setShowChatSheet(true)}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={chatEnabled ? theme.ink : theme.inkSoft}
              />
              <Text style={[styles.chatFabText, { color: chatEnabled ? theme.ink : theme.inkSoft }]}>{t.tabChat}</Text>
            </Pressable>
          </View>
        ) : null}
        </View>
      </View>

      <Modal
        transparent
        visible={showChatSheet}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowChatSheet(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowChatSheet(false)} />
          <View style={[styles.chatSheetAvoid, Platform.OS === 'web' ? styles.chatSheetAvoidWeb : null]}>
            <View style={[styles.chatSheet, { backgroundColor: theme.card, borderColor: theme.border, paddingBottom: keyboardHeight }]}> 
              <View style={styles.chatSheetHeader}>
                <View style={styles.chatHeaderLeft}>
                  <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.chatTitle}</Text>
                  <Text style={[styles.chatHeaderInstance, { color: theme.inkSoft }]}>
                    {t.currentInstanceLabel}: {selectedConnection ? selectedConnection.name : t.notSelected}
                  </Text>
                </View>
                <View style={styles.chatHeaderRight}>
                  <Pressable onPress={() => setShowChatSheet(false)}>
                    <Text style={[styles.toolButtonText, { color: theme.inkStrong }]}>{t.close}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.chatToolsRow}>
                <ToolTextButton
                  label={t.clear}
                  disabled={messages.length === 0}
                  onPress={handleClearChat}
                  color={theme.inkStrong}
                />
                <ToolTextButton
                  label={t.retry}
                  disabled={!canRetry}
                  onPress={handleRetryLast}
                  color={theme.inkStrong}
                />
                <ToolTextButton
                  label={t.copyReply}
                  disabled={!lastAssistantText}
                  onPress={handleCopyLastReply}
                  color={theme.inkStrong}
                />
                <Pressable
                  style={[styles.iconToolButton, { borderColor: theme.borderSoft, backgroundColor: theme.cardTint }]}
                  onPress={handleScrollToTop}
                  accessibilityRole="button"
                  accessibilityLabel="Scroll to top"
                >
                  <Ionicons name="arrow-up" size={14} color={theme.inkStrong} />
                </Pressable>
                <Pressable
                  style={[styles.iconToolButton, { borderColor: theme.borderSoft, backgroundColor: theme.cardTint }]}
                  onPress={handleScrollToBottom}
                  accessibilityRole="button"
                  accessibilityLabel="Scroll to bottom"
                >
                  <Ionicons name="arrow-down" size={14} color={theme.inkStrong} />
                </Pressable>
                {isSending ? (
                  <ToolTextButton
                    label={t.suspend}
                    onPress={handleSuspendRequest}
                    color={theme.offline}
                  />
                ) : null}
                {requestElapsedSeconds >= LONG_WAIT_REMINDER_SECONDS ? (
                  <ToolTextButton
                    label={t.reload}
                    onPress={handleReloadSession}
                    color={theme.inkStrong}
                  />
                ) : null}
              </View>

              <ScrollView
                ref={chatScrollRef}
                style={[styles.chatBox, { borderColor: theme.borderSoft }]}
                contentContainerStyle={styles.chatBoxContent}
              >
                {messages.length === 0 ? (
                  <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.sendFirst}</Text>
                ) : (
                  messages.map((message, index) => (
                    <AnimatedMessageBubble
                      key={message.id}
                      message={message}
                      index={index}
                      enabled={animationsEnabled}
                      onLongPress={() => copyBubbleContent(message.content)}
                      borderColor={theme.border}
                      userBubble={theme.userBubble}
                      assistantBubble={theme.assistantBubble}
                      inkColor={theme.ink}
                      softInkColor={theme.inkSoft}
                      userLabel={t.userLabel}
                      assistantLabel="Hermes"
                      toolLabel={t.toolLabel}
                      thinkingText={t.assistantThinking}
                      showProcessDetails={showProcessDetails}
                      processEntries={
                        message.id === activeAssistantIdRef.current
                          ? processEntries
                          : processEntriesByMessage[message.id] ?? []
                      }
                      isProgressHost={message.id === activeAssistantIdRef.current && isSending}
                    />
                  ))
                )}
              </ScrollView>

              <View style={{...styles.chatComposerRow}}>
                <TextInput
                  style={[
                    styles.input,
                    styles.chatInputInlineGrow,
                    {
                      borderColor: theme.borderSoft,
                      backgroundColor: theme.inputBg,
                      color: theme.ink,
                    },
                  ]}
                  placeholder={t.inputMessage}
                  placeholderTextColor={theme.inkSoft}
                  multiline={false}
                  value={chatInput}
                  onChangeText={setChatInput}
                />
                <ActionButton
                  label={isSending ? t.sending : t.send}
                  disabled={!selectedConnection || isSending}
                  onPress={handleSendMessage}
                  color={theme.buttonPrimary}
                  borderColor={theme.border}
                  textColor={theme.ink}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

async function streamChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  extraRequestBody,
  onDelta,
  onReasoning,
  onToolEvent,
  timeoutMs,
  signal,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: HermesChatMessage[];
  extraRequestBody?: Record<string, unknown>;
  onDelta: (delta: string) => void;
  onReasoning?: (reasoning: string) => void;
  onToolEvent?: (event?: ToolEventPayload) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
  // OpenAI-compatible SSE parser. Handles token deltas plus tool-call deltas.
  const normalized = HermesApiClient.normalizeBaseUrl(baseUrl);
  chatDebug('streamChatCompletion.start', { url: `${normalized}/v1/chat/completions` });
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let releaseExternalAbort: (() => void) | null = null;

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      releaseExternalAbort = () => signal.removeEventListener('abort', onAbort);
    }
  }

  if (Platform.OS !== 'web' && typeof XMLHttpRequest !== 'undefined') {
    chatDebug('streamChatCompletion.transport', 'xhr');
    await streamChatCompletionWithXhr({
      url: `${normalized}/v1/chat/completions`,
      apiKey,
      body: JSON.stringify({
        model,
        stream: true,
        messages,
        ...(extraRequestBody ?? {}),
      }),
      onDelta,
      onReasoning,
      onToolEvent,
      timeoutMs,
      signal: controller.signal,
    });
    return;
  }

  try {
    chatDebug('streamChatCompletion.transport', 'fetch');
    const response = await fetch(`${normalized}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
        ...(extraRequestBody ?? {}),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    chatDebug('streamChatCompletion.response', {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
    });

    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('Streaming is not supported in this runtime.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const streamState = { buffer: '', debugSamplesLogged: 0 };
    let chunkCount = 0;
    let eventCount = 0;
    let deltaChars = 0;
    let reasoningCount = 0;
    let toolEventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkCount += 1;

      const metrics = parseAndDispatchSseBlocks({
        chunk: decoder.decode(value, { stream: true }),
        state: streamState,
        onDelta,
        onReasoning,
        onToolEvent,
      });
      eventCount += metrics.events;
      deltaChars += metrics.deltaChars;
      reasoningCount += metrics.reasoningCount;
      toolEventCount += metrics.toolEvents;
    }
    chatDebug('streamChatCompletion.done', {
      chunkCount,
      eventCount,
      deltaChars,
      reasoningCount,
      toolEventCount,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (releaseExternalAbort) {
      releaseExternalAbort();
    }
  }
}

async function streamChatCompletionWithXhr({
  url,
  apiKey,
  body,
  onDelta,
  onReasoning,
  onToolEvent,
  timeoutMs,
  signal,
}: {
  url: string;
  apiKey: string;
  body: string;
  onDelta: (delta: string) => void;
  onReasoning?: (reasoning: string) => void;
  onToolEvent?: (event?: ToolEventPayload) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let consumedLength = 0;
    const streamState = { buffer: '', debugSamplesLogged: 0 };
    let chunkCount = 0;
    let eventCount = 0;
    let deltaChars = 0;
    let reasoningCount = 0;
    let toolEventCount = 0;
    let detached = false;

    const detach = () => {
      if (detached) return;
      detached = true;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        // no-op
      }
      detach();
      reject(new Error('AbortError'));
    };

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (timeoutMs && timeoutMs > 0) {
      xhr.timeout = timeoutMs;
    }

    xhr.onprogress = () => {
      const text = xhr.responseText || '';
      if (text.length <= consumedLength) return;
      const chunk = text.slice(consumedLength);
      consumedLength = text.length;
      chunkCount += 1;
      const metrics = parseAndDispatchSseBlocks({
        chunk,
        state: streamState,
        onDelta,
        onReasoning,
        onToolEvent,
      });
      eventCount += metrics.events;
      deltaChars += metrics.deltaChars;
      reasoningCount += metrics.reasoningCount;
      toolEventCount += metrics.toolEvents;
    };

    xhr.onerror = () => {
      detach();
      reject(new Error('Network request failed during streaming.'));
    };
    xhr.ontimeout = () => {
      detach();
      reject(new Error('Streaming request timed out.'));
    };
    xhr.onload = () => {
      // Flush any remaining parsed block.
      const flushMetrics = parseAndDispatchSseBlocks({
        chunk: '\n\n',
        state: streamState,
        onDelta,
        onReasoning,
        onToolEvent,
      });
      eventCount += flushMetrics.events;
      deltaChars += flushMetrics.deltaChars;
      reasoningCount += flushMetrics.reasoningCount;
      toolEventCount += flushMetrics.toolEvents;
      detach();
      chatDebug('streamChatCompletionWithXhr.done', {
        status: xhr.status,
        chunkCount,
        eventCount,
        deltaChars,
        reasoningCount,
        toolEventCount,
      });
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      }
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.send(body);
  });
}

function parseAndDispatchSseBlocks({
  chunk,
  state,
  onDelta,
  onReasoning,
  onToolEvent,
}: {
  chunk: string;
  state: { buffer: string; debugSamplesLogged: number };
  onDelta: (delta: string) => void;
  onReasoning?: (reasoning: string) => void;
  onToolEvent?: (event?: ToolEventPayload) => void;
}): { events: number; deltaChars: number; reasoningCount: number; toolEvents: number } {
  let eventCounter = 0;
  let deltaChars = 0;
  let reasoningCount = 0;
  let toolEvents = 0;
  state.buffer += chunk;
  const blocks = state.buffer.split(/\r?\n\r?\n/);
  state.buffer = blocks.pop() ?? '';

  for (const block of blocks) {
    eventCounter += 1;
    let eventName = '';
    const dataParts: string[] = [];

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataParts.push(line.slice(5).trimStart());
      }
    }



    if (dataParts.length === 0) continue;
    const payload = dataParts.join('\n').trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning?: string;
            reasoning_content?: string;
            thinking?: string;
            thought?: string;
            analysis?: string;
            tool_calls?: Array<{ function?: { name?: string } }>;
            tool_name?: string;
            function_call?: { name?: string };
          };
          message?: {
            content?: string;
            reasoning?: string;
            reasoning_content?: string;
            thinking?: string;
            thought?: string;
            analysis?: string;
          };
        }>;
        delta?: {
          content?: string;
          reasoning?: string;
          reasoning_content?: string;
          thinking?: string;
          thought?: string;
          analysis?: string;
        };
        event?: string;
        type?: string;
        output_text?: string;
        message?: {
          content?: string;
          text?: string;
        };
      };
      if (eventName && !parsed.event) {
        parsed.event = eventName;
      }

      if (state.debugSamplesLogged < 8) {
        state.debugSamplesLogged += 1;
        const choice0 = (parsed.choices?.[0] ?? {}) as Record<string, unknown>;
        const delta = (choice0.delta ?? parsed.delta ?? {}) as Record<string, unknown>;
        const message = (choice0.message ?? parsed.message ?? {}) as Record<string, unknown>;
        chatDebug('stream.sample', {
          event: eventName || parsed.event || '',
          type: parsed.type || '',
          deltaKeys: Object.keys(delta).slice(0, 8),
          messageKeys: Object.keys(message).slice(0, 8),
          rootKeys: Object.keys(parsed).slice(0, 10),
        });
      }

      const deltaTextsPrimary = [
        ...extractContentTexts(parsed.choices?.[0]?.delta),
        ...extractContentTexts(parsed.delta),
      ];
      const deltaTextsFallback =
        deltaTextsPrimary.length > 0
          ? []
          : [
              ...extractContentTexts(parsed.choices?.[0]?.message),
              ...extractContentTexts(parsed.message),
              ...extractContentTexts(parsed),
            ];
      const deltaTexts = deltaTextsPrimary.length > 0 ? deltaTextsPrimary : deltaTextsFallback;
      const eventHint = `${eventName} ${parsed.event ?? ''} ${parsed.type ?? ''}`.trim();
      const isReasoningEvent = /reason|think|analysis|thought/i.test(eventHint);

      const reasoningChunks = uniqTexts([
        ...extractReasoningTexts(parsed.choices?.[0]?.delta),
        ...extractReasoningTexts(parsed.choices?.[0]?.message),
        ...extractReasoningTexts(parsed.delta),
        ...extractReasoningTexts(parsed.message),
        ...extractReasoningTexts(parsed),
      ]);
      if (reasoningChunks.length > 0) {
        reasoningCount += 1;
        onReasoning?.(reasoningChunks.join('\n'));
      }
      if (reasoningChunks.length === 0 && isReasoningEvent && deltaTexts.length > 0) {
        reasoningCount += 1;
        onReasoning?.(deltaTexts.join('\n'));
      } else if (deltaTexts.length > 0) {
        const text = deltaTexts.join('');
        deltaChars += text.length;
        onDelta(text);
      }

     
      const deltaObj = parsed.choices?.[0]?.delta;
      const messageObj = parsed.choices?.[0]?.message as Record<string, unknown> | undefined;
      const toolSignal = extractToolSignal({
        parsed,
        eventName,
        deltaObj: (deltaObj as Record<string, unknown> | undefined) ?? undefined,
        messageObj,
      });
      if (toolSignal.hasToolEvent) {
        toolEvents += 1;
        onToolEvent?.({
          toolName: toolSignal.toolName,
          detail: toolSignal.detail,
        });
      }
      if (
        eventName ||
        parsed.event ||
        parsed.type ||
        reasoningChunks.length > 0 ||
        (deltaTexts.length > 0 && deltaTextsPrimary.length === 0)
      ) {
        chatDebug('stream.event', {
          event: eventName || parsed.event || '',
          type: parsed.type || '',
          reasoningEvent: isReasoningEvent,
          deltaChars: deltaTexts.join('').length,
          reasoningChunks: reasoningChunks.length,
          hasToolEvent:
            toolSignal.hasToolEvent,
          toolName: toolSignal.toolName || '',
          toolDetailChars: toolSignal.detail?.length ?? 0,
          toolNameCandidates: toolSignal.candidates,
        });
      }
    } catch {
      if (state.debugSamplesLogged < 8) {
        state.debugSamplesLogged += 1;
        chatDebug('stream.sample.raw', {
          event: eventName || '',
          payloadPreview: payload.slice(0, 180),
        });
      }
      if (eventName.includes('reason') || eventName.includes('thinking')) {
        reasoningCount += 1;
        onReasoning?.(payload);
        continue;
      }
      if (eventName.includes('text') || eventName.includes('message')) {
        deltaChars += payload.length;
        onDelta(payload);
        continue;
      }
    }
  }
  return { events: eventCounter, deltaChars, reasoningCount, toolEvents };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort/i.test(text);
}

function extractReasoningTexts(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const keys = [
    'reasoning',
    'reasoning_content',
    'reasoning_text',
    'thinking',
    'thinking_content',
    'thought',
    'thoughts',
    'analysis',
    'internal_reasoning',
  ];
  const output = new Set<string>();
  const queue: unknown[] = [payload];
  let iterations = 0;

  while (queue.length > 0 && iterations < 120) {
    iterations += 1;
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    const source = current as Record<string, unknown>;
    const typeValue = source.type;
    const contentValue = source.content;
    if (
      typeof typeValue === 'string' &&
      /reason|think|analysis|thought/i.test(typeValue) &&
      typeof contentValue === 'string' &&
      contentValue.trim()
    ) {
      output.add(contentValue.trim());
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        output.add(value.trim());
        continue;
      }
      if (Array.isArray(value)) {
        for (const part of value) {
          if (typeof part === 'string' && part.trim()) {
            output.add(part.trim());
          } else if (part && typeof part === 'object') {
            const partText = (part as Record<string, unknown>).text;
            if (typeof partText === 'string' && partText.trim()) {
              output.add(partText.trim());
            }
          }
        }
      }
    }

    for (const value of Object.values(source)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return Array.from(output);
}

function uniqTexts(parts: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of parts) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    output.push(item);
  }
  return output;
}

function extractContentTexts(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const keys = ['content', 'text', 'output_text', 'delta'];
  const output: string[] = [];
  const queue: unknown[] = [payload];
  let iterations = 0;

  while (queue.length > 0 && iterations < 120) {
    iterations += 1;
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    const source = current as Record<string, unknown>;

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.length > 0) {
        output.push(value);
        continue;
      }
      if (Array.isArray(value)) {
        for (const part of value) {
          if (typeof part === 'string' && part.length > 0) {
            output.push(part);
          } else if (part && typeof part === 'object') {
            const partRecord = part as Record<string, unknown>;
            const partText = partRecord.text ?? partRecord.value ?? partRecord.content;
            if (typeof partText === 'string' && partText.length > 0) {
              output.push(partText);
            }
          }
        }
      }
    }

    for (const value of Object.values(source)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return output;
}

function extractAssistantText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const obj = response as Record<string, unknown>;
  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  const firstChoice = (choices[0] ?? {}) as Record<string, unknown>;
  const message = firstChoice.message;
  const direct = extractContentTexts(message).join('');
  if (direct.trim()) return direct;

  const fallback = extractContentTexts(response).join('');
  return fallback.trim();
}

function splitThinkingFromText(raw: string): { content: string; reasoning: string } {
  if (!raw) return { content: '', reasoning: '' };
  const tagRegex = /<\/?(think|thinking|reasoning)\s*>/gi;
  let inThinking = false;
  let cursor = 0;
  let content = '';
  let reasoning = '';
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(raw)) !== null) {
    const tagStart = match.index;
    const tagText = match[0] || '';
    const segment = raw.slice(cursor, tagStart);
    if (segment) {
      if (inThinking) reasoning += segment;
      else content += segment;
    }
    inThinking = !tagText.startsWith('</');
    cursor = tagStart + tagText.length;
  }

  const tail = raw.slice(cursor);
  if (tail) {
    if (inThinking) reasoning += tail;
    else content += tail;
  }

  return { content, reasoning };
}

function consumeThinkingDelta(
  state: ThinkingStreamState,
  delta: string,
): { contentDelta: string; reasoningDelta: string } {
  state.raw += delta;
  const parsed = splitThinkingFromText(state.raw);
  const contentDelta =
    parsed.content.length >= state.renderedContent.length
      ? parsed.content.slice(state.renderedContent.length)
      : parsed.content;
  const reasoningDelta =
    parsed.reasoning.length >= state.renderedReasoning.length
      ? parsed.reasoning.slice(state.renderedReasoning.length)
      : parsed.reasoning;
  state.renderedContent = parsed.content;
  state.renderedReasoning = parsed.reasoning;
  return { contentDelta, reasoningDelta };
}

function extractToolName(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const source = payload as Record<string, unknown>;
  const candidates = [
    source.tool_name,
    (source.tool as Record<string, unknown> | undefined)?.name,
    (source.data as Record<string, unknown> | undefined)?.tool_name,
    (source.data as Record<string, unknown> | undefined)?.name,
    (source.delta as Record<string, unknown> | undefined)?.tool_name,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function extractToolSignal({
  parsed,
  eventName,
  deltaObj,
  messageObj,
}: {
  parsed: Record<string, unknown>;
  eventName: string;
  deltaObj?: Record<string, unknown>;
  messageObj?: Record<string, unknown>;
}): { hasToolEvent: boolean; toolName?: string; detail?: string; candidates: string[] } {
  const parsedData = parsed.data as Record<string, unknown> | undefined;
  const parsedToolRaw = parsed.tool;
  const parsedTool = (parsedToolRaw && typeof parsedToolRaw === 'object'
    ? (parsedToolRaw as Record<string, unknown>)
    : undefined);
  const parsedDelta = parsed.delta as Record<string, unknown> | undefined;
  const rootToolCalls = parsed.tool_calls as unknown[] | undefined;
  const deltaToolCalls = deltaObj?.tool_calls as unknown[] | undefined;
  const messageToolCalls = messageObj?.tool_calls as unknown[] | undefined;
  const dataToolCalls = parsedData?.tool_calls as unknown[] | undefined;

  const candidates = uniqTexts(
    [
      deltaObj?.tool_name,
      (deltaObj?.function_call as Record<string, unknown> | undefined)?.name,
      getFirstToolCallName(deltaToolCalls),
      messageObj?.tool_name,
      (messageObj?.function_call as Record<string, unknown> | undefined)?.name,
      getFirstToolCallName(messageToolCalls),
      parsedDelta?.tool_name,
      (parsedDelta?.function_call as Record<string, unknown> | undefined)?.name,
      getFirstToolCallName(parsedDelta?.tool_calls as unknown[] | undefined),
      parsed.tool_name,
      getFirstToolCallName(rootToolCalls),
      parsedData?.tool_name,
      parsedData?.name,
      parsed.label as string | undefined,
      parsedToolRaw as string | undefined,
      getFirstToolCallName(dataToolCalls),
      (parsedTool?.function as Record<string, unknown> | undefined)?.name,
      parsedTool?.name,
      extractToolName(parsed),
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
  );

  const eventHint = `${eventName} ${String(parsed.event ?? '')} ${String(parsed.type ?? '')}`.toLowerCase();
  const hasToolEvent =
    Boolean(deltaToolCalls?.length) ||
    Boolean(messageToolCalls?.length) ||
    Boolean(rootToolCalls?.length) ||
    Boolean(dataToolCalls?.length) ||
    Boolean(deltaObj?.tool_name || messageObj?.tool_name || parsed.tool_name || parsedData?.tool_name) ||
    Boolean((deltaObj?.function_call as Record<string, unknown> | undefined)?.name) ||
    Boolean((messageObj?.function_call as Record<string, unknown> | undefined)?.name) ||
    eventHint.includes('tool') ||
    eventHint.includes('function_call');

  const detail = formatToolDetail(parsed, eventName);

  return {
    hasToolEvent,
    toolName: candidates[0],
    detail,
    candidates,
  };
}

function getFirstToolCallName(toolCalls: unknown[] | undefined): string | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return undefined;
  for (const call of toolCalls) {
    if (!call || typeof call !== 'object') continue;
    const record = call as Record<string, unknown>;
    const functionObj = record.function as Record<string, unknown> | undefined;
    const name = functionObj?.name ?? record.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return undefined;
}

function formatToolDetail(parsed: Record<string, unknown>, eventName: string): string | undefined {
  const lines: string[] = [];
  const toolRaw = parsed.tool;
  const labelRaw = parsed.label;
  const statusRaw = parsed.status;
  const toolCallIdRaw = parsed.toolCallId ?? parsed.tool_call_id;
  const emojiRaw = parsed.emoji;

  if (typeof eventName === 'string' && eventName.trim()) lines.push(`event: ${eventName.trim()}`);
  if (typeof toolRaw === 'string' && toolRaw.trim()) lines.push(`tool: ${toolRaw.trim()}`);
  if (typeof labelRaw === 'string' && labelRaw.trim()) lines.push(`label: ${labelRaw.trim()}`);
  if (typeof statusRaw === 'string' && statusRaw.trim()) lines.push(`status: ${statusRaw.trim()}`);
  if (typeof toolCallIdRaw === 'string' && toolCallIdRaw.trim()) lines.push(`toolCallId: ${toolCallIdRaw.trim()}`);
  if (typeof emojiRaw === 'string' && emojiRaw.trim()) lines.push(`emoji: ${emojiRaw.trim()}`);

  const args = pickSerializableField(parsed, ['arguments', 'args', 'input', 'params', 'parameters']);
  if (args) lines.push(`args:\n${args}`);
  const result = pickSerializableField(parsed, ['result', 'output', 'response', 'data']);
  if (result) lines.push(`result:\n${result}`);

  if (lines.length === 0) return undefined;
  return lines.join('\n');
}

function pickSerializableField(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value == null) continue;
    if (typeof value === 'string') {
      if (value.trim()) return value.trim();
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      try {
        const text = JSON.stringify(value);
        if (text && text !== '{}' && text !== '[]') return text;
      } catch {
        // ignore unserializable payload
      }
    }
  }
  return undefined;
}

function extractHermesVersion(payload: unknown): string | null {
  // Scan nested health payloads from different gateway formats and return first known version key.
  if (!payload || typeof payload !== 'object') return null;
  const stack: unknown[] = [payload];
  const keyPriority = ['hermes_version', 'version', 'app_version', 'server_version', 'build_version'];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;

    for (const key of keyPriority) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return null;
}
