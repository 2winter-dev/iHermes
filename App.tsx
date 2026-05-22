import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,

  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HermesApiClient } from './src/api/hermes/client';
import { HermesChatMessage, HermesConnection } from './src/api/hermes/types';
import { ChatHistoryMap, loadChatHistoryMap, saveChatHistoryMap } from './src/storage/chat_history';
import { loadConnections, saveConnections } from './src/storage/connections';
import {
  AppPreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from './src/storage/preferences';
import { borderWidths, radii, ThemeMode, themes } from './src/theme/tokens';

type TabKey = 'instances' | 'settings';
type ConnectionState = 'idle' | 'testing' | 'online' | 'offline';
type ToolStepStatus = 'running' | 'success' | 'failed';
type SupportedLanguage = 'zh' | 'en';
type LanguagePreference = 'device' | SupportedLanguage;

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

const APP_VERSION = 'v0.1';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const WEB_MAX_WIDTH = 520;
const AUTHOR_XHS_URL = 'https://xhslink.com/m/1pRHxd9V2xH';
const ANDROID_APK_DOWNLOAD_URL =
  'https://github.com/2winter-dev/iHermes/releases/tag/beta0.1';
const OPEN_SOURCE_REPO_URL = 'https://github.com/2winter-dev/iHermes';
const translations = {
  zh: {
    notTested: '未测试',
    unknown: '未知',
    statusOnline: '在线',
    statusOffline: '离线',
    statusTesting: '测试中',
    statusUnchecked: '未检测',
    missingFieldsTitle: '缺少字段',
    missingFieldsConnection: '请填写名称、Base URL 和 API Key。',
    missingFieldsTest: '请先填写 Base URL 和 API Key。',
    currentInstance: '当前实例',
    noInstanceSelectedTitle: '未选择实例',
    noInstanceSelectedDesc: '请先在“已保存实例”里选择一个实例。',
    updatedHint: '连接已更新，建议重新测试',
    savedHint: '连接已保存，建议测试',
    heroSubtitle: '本地 Hermes 会话助手 · 聚焦对话，随时开聊',
    savedInstances: '已保存实例',
    noSavedInstances: '暂无实例，先在下方保存一个。',
    modelLabel: '模型',
    edit: '编辑',
    instanceManagement: '实例管理',
    expand: '展开',
    collapse: '收起',
    namePlaceholder: '名称（例如：本机默认）',
    urlPlaceholder: 'Base URL（例如：http://192.168.1.8:8642）',
    apiKeyPlaceholder: 'API Key',
    modelAutoHint: '模型将于连接成功后自动获取',
    save: '保存',
    updateSave: '更新保存',
    testingLabel: '检测中...',
    testConnection: '检测连接',
    delete: '删除',
    collapsedHint: '已折叠，点击“展开”进行新增或编辑。',
    settings: '设置功能',
    theme: '主题',
    themeWarm: '暖色',
    themeSoft: '浅淡',
    language: '语言',
    langDevice: '跟随设备',
    langChinese: '中文',
    langEnglish: 'English',
    animations: '动画',
    on: '开',
    off: '关',
    versionInfo: '版本信息',
    hermesVersion: 'Hermes 版本',
    appVersion: 'App 版本',
    help: '实验帮助',
    authorContact: '作者联系',
    installPwa: '安装到主屏幕（PWA）',
    installIhermes: '安装 iHermes',
    iosPwaHint: 'iOS Safari：点击底部“分享”按钮，再点“添加到主屏幕”。',
    androidPwaHint: 'Android Chrome：右上角菜单中选择“添加到主屏幕”。',
    howToApiKey: '如何获取 API Key',
    faq: 'FAQ',
    apkDownload: 'Android 下载',
    downloadAndroidApk: '下载 Android APK',
    tabInstances: '实例',
    tabSettings: '设置',
    tabChat: '聊天',
    chatTitle: '聊天',
    thinking: '思考中',
    close: '关闭',
    toolSteps: '工具调用步骤',
    stepSuccess: '成功',
    stepFailed: '失败',
    stepRunning: '进行中',
    clear: '清空',
    retry: '重试',
    copyReply: '复制回复',
    currentInstanceLabel: '当前实例',
    notSelected: '未选择',
    sendFirst: '发送第一条消息开始会话。',
    inputMessage: '输入消息',
    sending: '发送中',
    send: '发送',
    userLabel: '你',
    assistantThinking: 'Hermes 正在思考...',
    assistantReplying: 'Hermes 正在回复...',
    callingTool: '正在调用工具',
    callingToolFallback: '正在调用工具...',
    emptyResponse: '(空响应)',
    noCopyContentTitle: '暂无内容',
    noCopyContentDesc: '还没有可复制的 Hermes 回复。',
    copiedTitle: '已复制',
    copiedReplyDesc: '最后一条 Hermes 回复已复制到剪贴板。',
    copiedBubbleDesc: '气泡内容已复制。',
    connectSuccess: '连接成功，配置模型',
    apiModel: 'API模型',
    connectFailed: '连接失败',
    requestFailed: '请求失败',
    retryFailed: '重试失败',
    apiHelp1: '1. 在 Hermes 节点编辑 `~/.hermes/.env`。',
    apiHelp2: '2. 写入 `API_SERVER_ENABLED=true`。',
    apiHelp3: '3. 生成 key（推荐）：`openssl rand -hex 32`。',
    apiHelp4: '4. 或者手动输入：自己写一串 32 位以上、尽量随机且不易猜到的字符串（字母+数字）。',
    apiHelp5: '5. 写入 `API_SERVER_KEY=<你的key>`。',
    apiHelp6: '6. 启动 `hermes gateway`，在实例里填 Base URL + API Key。',
    faqQ1: 'Q1: Web/PWA 能直连 `192.168.x.x` 吗？',
    faqA1: 'A1: 通常会被 HTTPS + CORS 限制，推荐先给 Hermes 提供 HTTPS 入口。',
    faqQ2: 'Q2: 怎么把本地 Hermes 暴露成 HTTPS？',
    faqA2: 'A2: 推荐 Cloudflare Tunnel 或 Tailscale Funnel，再在实例里填写对应 https 地址。',
    faqQ3: 'Q3: 移动端建议用哪个？',
    faqA3: 'A3: 建议优先使用 Android 版本，连接本地网关更稳定。',
    openSource: '开源项目',
    viewRepository: '查看 GitHub 仓库',
  },
  en: {
    notTested: 'Not tested',
    unknown: 'Unknown',
    statusOnline: 'Online',
    statusOffline: 'Offline',
    statusTesting: 'Testing',
    statusUnchecked: 'Unchecked',
    missingFieldsTitle: 'Missing fields',
    missingFieldsConnection: 'Please fill in Name, Base URL, and API Key.',
    missingFieldsTest: 'Please enter Base URL and API Key first.',
    currentInstance: 'Current instance',
    noInstanceSelectedTitle: 'No instance selected',
    noInstanceSelectedDesc: 'Please select one from Saved Instances first.',
    updatedHint: 'Connection updated. Please test again.',
    savedHint: 'Connection saved. Please run a connection test.',
    heroSubtitle: 'Local Hermes chat assistant · chat-first workflow',
    savedInstances: 'Saved Instances',
    noSavedInstances: 'No saved instance yet. Create one below.',
    modelLabel: 'Model',
    edit: 'Edit',
    instanceManagement: 'Instance Management',
    expand: 'Expand',
    collapse: 'Collapse',
    namePlaceholder: 'Name (for example: Local Default)',
    urlPlaceholder: 'Base URL (for example: http://192.168.1.8:8642)',
    apiKeyPlaceholder: 'API Key',
    modelAutoHint: 'Model is auto-detected after successful connection',
    save: 'Save',
    updateSave: 'Update',
    testingLabel: 'Testing...',
    testConnection: 'Test Connection',
    delete: 'Delete',
    collapsedHint: 'Collapsed. Tap "Expand" to add or edit.',
    settings: 'Settings',
    theme: 'Theme',
    themeWarm: 'Warm',
    themeSoft: 'Soft',
    language: 'Language',
    langDevice: 'Device',
    langChinese: 'Chinese',
    langEnglish: 'English',
    animations: 'Animations',
    on: 'On',
    off: 'Off',
    versionInfo: 'Version',
    hermesVersion: 'Hermes Version',
    appVersion: 'App Version',
    help: 'Help',
    authorContact: 'Author',
    installPwa: 'Install to Home Screen (PWA)',
    installIhermes: 'Install iHermes',
    iosPwaHint: 'iOS Safari: tap Share, then Add to Home Screen.',
    androidPwaHint: 'Android Chrome: open menu, then Add to Home screen.',
    howToApiKey: 'How to get API Key',
    faq: 'FAQ',
    apkDownload: 'Android Download',
    downloadAndroidApk: 'Download Android APK',
    tabInstances: 'Instances',
    tabSettings: 'Settings',
    tabChat: 'Chat',
    chatTitle: 'Chat',
    thinking: 'Thinking',
    close: 'Close',
    toolSteps: 'Tool Steps',
    stepSuccess: 'Success',
    stepFailed: 'Failed',
    stepRunning: 'Running',
    clear: 'Clear',
    retry: 'Retry',
    copyReply: 'Copy Reply',
    currentInstanceLabel: 'Current',
    notSelected: 'Not selected',
    sendFirst: 'Send your first message to start.',
    inputMessage: 'Type a message',
    sending: 'Sending',
    send: 'Send',
    userLabel: 'You',
    assistantThinking: 'Hermes is thinking...',
    assistantReplying: 'Hermes is replying...',
    callingTool: 'Calling tool',
    callingToolFallback: 'Calling tool...',
    emptyResponse: '(empty response)',
    noCopyContentTitle: 'No content',
    noCopyContentDesc: 'No Hermes reply available to copy.',
    copiedTitle: 'Copied',
    copiedReplyDesc: 'Latest Hermes reply copied.',
    copiedBubbleDesc: 'Message copied.',
    connectSuccess: 'connected, selected model',
    apiModel: 'API model',
    connectFailed: 'connection failed',
    requestFailed: 'Request failed',
    retryFailed: 'Retry failed',
    apiHelp1: '1. Edit `~/.hermes/.env` on your Hermes host.',
    apiHelp2: '2. Set `API_SERVER_ENABLED=true`.',
    apiHelp3: '3. Generate a key (recommended): `openssl rand -hex 32`.',
    apiHelp4: '4. Or manually use a random 32+ character string (letters + numbers).',
    apiHelp5: '5. Set `API_SERVER_KEY=<your_key>`.',
    apiHelp6: '6. Start `hermes gateway`, then fill Base URL + API Key in iHermes.',
    faqQ1: 'Q1: Can Web/PWA connect directly to `192.168.x.x`?',
    faqA1: 'A1: Usually blocked by HTTPS + CORS policy. Prefer exposing Hermes over HTTPS first.',
    faqQ2: 'Q2: How can I expose local Hermes via HTTPS?',
    faqA2: 'A2: Use Cloudflare Tunnel or Tailscale Funnel, then fill that HTTPS URL.',
    faqQ3: 'Q3: Which mobile client is recommended?',
    faqA3: 'A3: Android app is recommended for more stable local gateway connectivity.',
    openSource: 'Open Source',
    viewRepository: 'View GitHub Repository',
  },
} as const;
const SEO_TITLE = 'iHermes App - Hermes 手机版（iOS / Android）';
const SEO_DESCRIPTION =
  'iHermes 是 Hermes 手机版客户端，支持 iOS、Android 与 Web App，多实例连接、会话对话、工具调用可视化。';
const SEO_KEYWORDS =
  'Hermes app,Hermes iOS,Hermes Android,Hermes 手机版,本地 Hermes,AI Agent App,多实例会话';

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
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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
  const [toolStepsExpanded, setToolStepsExpanded] = useState(true);
  const [hermesVersion, setHermesVersion] = useState<string>(translations.zh.unknown);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);

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
  const resolvedLanguage: SupportedLanguage = useMemo(() => {
    if (languagePreference === 'zh' || languagePreference === 'en') {
      return languagePreference;
    }
    if (deviceLocale.startsWith('zh')) {
      return 'zh';
    }
    return 'en';
  }, [deviceLocale, languagePreference]);
  const t = translations[resolvedLanguage];

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
      setForm((prev) => (prev.id ? prev : { ...prev, model: savedPrefs.defaultModel }));
      setPrefsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) {
      return;
    }
    const next: AppPreferences = { themeMode, animationsEnabled, defaultModel, languagePreference };
    void savePreferences(next);
  }, [animationsEnabled, defaultModel, languagePreference, prefsLoaded, themeMode]);

  useEffect(() => {
    if (!selectedId) return;
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
  }, [messages, selectedId]);

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

    const previousTitle = document.title;
    document.title = SEO_TITLE;

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

    upsertMeta('name', 'description', SEO_DESCRIPTION);
    upsertMeta('name', 'keywords', SEO_KEYWORDS);
    upsertMeta('name', 'robots', 'index,follow,max-image-preview:large');
    upsertMeta('name', 'theme-color', '#EBC27A');

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'iHermes');
    upsertMeta('property', 'og:title', SEO_TITLE);
    upsertMeta('property', 'og:description', SEO_DESCRIPTION);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', imageUrl);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', SEO_TITLE);
    upsertMeta('name', 'twitter:description', SEO_DESCRIPTION);
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
          description: SEO_DESCRIPTION,
          keywords: SEO_KEYWORDS,
          inLanguage: 'zh-CN',
        },
        {
          '@type': 'SoftwareApplication',
          name: 'iHermes',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Web, iOS, Android',
          description: SEO_DESCRIPTION,
          keywords: SEO_KEYWORDS,
          url: canonicalUrl,
          image: imageUrl,
          softwareVersion: APP_VERSION,
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
          sameAs: [AUTHOR_XHS_URL],
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

    const placeholderId = `${Date.now()}-a`;
    const placeholder: ChatBubble = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);
    setChatPhaseText(t.assistantThinking);
    setToolSteps([]);
    setToolStepsExpanded(true);

    try {
      await streamChatCompletion({
        baseUrl: selectedConnection.baseUrl,
        apiKey: selectedConnection.apiKey,
        model: selectedConnection.model || defaultModel,
        messages: history.map((msg) => ({ role: msg.role, content: msg.content })),
        onDelta: (delta) => {
          if (!delta) return;
          setChatPhaseText(t.assistantReplying);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === placeholderId ? { ...msg, content: msg.content + delta } : msg)),
          );
        },
        onToolEvent: (toolName) => {
          pushToolStep(toolName);
          setChatPhaseText(toolName ? `${t.callingTool} ${toolName}` : t.callingToolFallback);
        },
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === placeholderId && !msg.content.trim() ? { ...msg, content: t.emptyResponse } : msg,
        ),
      );
      completeRunningToolSteps(true);
      setChatPhaseText('');
    } catch {
      const client = new HermesApiClient(selectedConnection);
      const response = await client.chatCompletion({
        model: selectedConnection.model || defaultModel,
        stream: false,
        messages: history.map((msg) => ({ role: msg.role, content: msg.content })),
      });
      const text = response.choices?.[0]?.message?.content ?? t.emptyResponse;
      setMessages((prev) => prev.map((msg) => (msg.id === placeholderId ? { ...msg, content: text } : msg)));
      completeRunningToolSteps(true);
      setChatPhaseText('');
    }
  }

  async function handleSendMessage() {
    const prompt = chatInput.trim();
    if (!selectedConnection || !prompt) {
      return;
    }

    setIsSending(true);
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
    try {
      await requestAssistantReply(truncated);
    } catch (error) {
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
  }

  async function copyBubbleContent(content: string) {
    await Clipboard.setStringAsync(content);
    Alert.alert(t.copiedTitle, t.copiedBubbleDesc);
  }

  function pushToolStep(name?: string) {
    const stepName = name?.trim() ? name.trim() : 'unknown_tool';
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
          name: stepName,
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
          <ScrollView contentContainerStyle={styles.container}>
            <AnimatedCard delay={0} enabled={animationsEnabled}>
              <View
                style={[styles.heroCard, { backgroundColor: theme.cardWarm, borderColor: theme.border }]}
              >
                <Image
                  source={require('./assets/hermes-logo.png')}
                  style={[styles.logo, { borderColor: theme.border }]}
                />
                <View style={styles.heroTextWrap}>
                  <Text style={[styles.title, { color: theme.inkStrong }]}>iHermes Chat</Text>
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
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
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
                          secureTextEntry
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

                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.animations}</Text>
                    <View style={styles.row}>
                      <ActionButton
                        label={animationsEnabled ? t.on : t.off}
                        onPress={() => setAnimationsEnabled((v) => !v)}
                        color={theme.buttonPrimary}
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
                      <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.hermesVersion}: {hermesVersion}</Text>
                      <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.appVersion}: {APP_VERSION}</Text>
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
                      onPress={() => void Linking.openURL(AUTHOR_XHS_URL)}
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
                    </View>
                    <Text style={[styles.settingLabel, { color: theme.inkStrong }]}>{t.openSource}</Text>
                    <Pressable
                      style={[
                        styles.contactLinkButton,
                        { borderColor: theme.borderSoft, backgroundColor: theme.inputBg },
                      ]}
                      onPress={() => void Linking.openURL(OPEN_SOURCE_REPO_URL)}
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
                          onPress={() => void Linking.openURL(ANDROID_APK_DOWNLOAD_URL)}
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
            <View style={[styles.chatSheet, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <View style={styles.chatSheetHeader}>
                <Text style={[styles.cardTitle, { color: theme.inkStrong }]}>{t.chatTitle}</Text>
                <View style={styles.chatHeaderRight}>
                  {isSending ? (
                    <View style={styles.thinkingChip}>
                      <ActivityIndicator size="small" color={theme.inkStrong} />
                      <Text style={[styles.thinkingChipText, { color: theme.inkStrong }]}>{t.thinking}</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => setShowChatSheet(false)}>
                    <Text style={[styles.toolButtonText, { color: theme.inkStrong }]}>{t.close}</Text>
                  </Pressable>
                </View>
              </View>
              {chatPhaseText ? (
                <Text style={[styles.phaseText, { color: theme.inkSoft }]}>{chatPhaseText}</Text>
              ) : null}
              {toolSteps.length > 0 ? (
                <View style={[styles.stepsPanel, { borderColor: theme.borderSoft }]}>
                  <Pressable
                    style={styles.stepsHeader}
                    onPress={() => setToolStepsExpanded((v) => !v)}
                  >
                    <Text style={[styles.stepsTitle, { color: theme.inkStrong }]}>
                      {t.toolSteps} ({toolSteps.length})
                    </Text>
                    <Text style={[styles.stepsToggle, { color: theme.inkSoft }]}>
                      {toolStepsExpanded ? t.collapse : t.expand}
                    </Text>
                  </Pressable>
                  {toolStepsExpanded ? (
                    <View style={styles.stepsList}>
                      {toolSteps.map((step, idx) => (
                        <View key={step.id} style={styles.stepRow}>
                          <Text style={[styles.stepIndex, { color: theme.inkSoft }]}>{idx + 1}.</Text>
                          <Text style={[styles.stepName, { color: theme.ink }]}>{step.name}</Text>
                          <Text
                            style={[
                              styles.stepStatus,
                              {
                                color:
                                  step.status === 'success'
                                    ? theme.online
                                    : step.status === 'failed'
                                    ? theme.offline
                                    : theme.testing,
                              },
                            ]}
                          >
                            {step.status === 'success'
                              ? t.stepSuccess
                              : step.status === 'failed'
                              ? t.stepFailed
                              : t.stepRunning}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
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
              </View>
              <Text style={[styles.hint, { color: theme.inkSoft }]}>{t.currentInstanceLabel}: {selectedConnection ? selectedConnection.name : t.notSelected}</Text>

              <ScrollView
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
                      thinkingText={t.assistantThinking}
                    />
                  ))
                )}
              </ScrollView>

              <View style={styles.chatComposerRow}>
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
  onDelta,
  onToolEvent,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: HermesChatMessage[];
  onDelta: (delta: string) => void;
  onToolEvent?: (toolName?: string) => void;
}): Promise<void> {
  const normalized = HermesApiClient.normalizeBaseUrl(baseUrl);
  const response = await fetch(`${normalized}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Streaming is not supported in this runtime.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{ function?: { name?: string } }>;
              tool_name?: string;
              function_call?: { name?: string };
            };
            message?: { content?: string };
          }>;
          delta?: { content?: string };
          event?: string;
        };

        const delta =
          parsed.choices?.[0]?.delta?.content ??
          parsed.choices?.[0]?.message?.content ??
          parsed.delta?.content ??
          '';

        if (delta) onDelta(delta);

        const deltaObj = parsed.choices?.[0]?.delta;
        const toolName =
          deltaObj?.tool_calls?.[0]?.function?.name ??
          deltaObj?.tool_name ??
          deltaObj?.function_call?.name;
        if (deltaObj?.tool_calls || deltaObj?.tool_name || deltaObj?.function_call || parsed.event?.includes('tool')) {
          onToolEvent?.(toolName);
        }
      } catch {
        continue;
      }
    }
  }
}

function AnimatedCard({
  children,
  delay,
  enabled,
}: {
  children: React.ReactNode;
  delay: number;
  enabled: boolean;
}) {
  const fade = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const rise = useRef(new Animated.Value(enabled ? 6 : 0)).current;

  useEffect(() => {
    if (!enabled) {
      fade.setValue(1);
      rise.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [delay, enabled, fade, rise]);

  return <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>{children}</Animated.View>;
}

function AnimatedMessageBubble({
  message,
  index,
  enabled,
  onLongPress,
  borderColor,
  userBubble,
  assistantBubble,
  inkColor,
  softInkColor,
  userLabel,
  assistantLabel,
  thinkingText,
}: {
  message: ChatBubble;
  index: number;
  enabled: boolean;
  onLongPress: () => void;
  borderColor: string;
  userBubble: string;
  assistantBubble: string;
  inkColor: string;
  softInkColor: string;
  userLabel: string;
  assistantLabel: string;
  thinkingText: string;
}) {
  const fade = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const slide = useRef(new Animated.Value(enabled ? 10 : 0)).current;

  useEffect(() => {
    if (!enabled) {
      fade.setValue(1);
      slide.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        delay: Math.min(index * 26, 180),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        delay: Math.min(index * 26, 180),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [enabled, fade, index, slide]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={[styles.bubbleRow, message.role === 'user' ? styles.userBubbleRow : styles.assistantBubbleRow]}>
        {message.role === 'assistant' ? (
          <Image source={require('./assets/hermes-logo.png')} style={styles.assistantAvatar} />
        ) : null}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={280}
          style={[
            styles.bubble,
            message.role === 'user' ? styles.userBubbleWrap : styles.assistantBubbleWrap,
            { borderColor, backgroundColor: message.role === 'user' ? userBubble : assistantBubble },
          ]}
        >
          <View style={styles.bubbleHeader}>
            <Text style={[styles.bubbleRole, { color: softInkColor }]}>{message.role === 'user' ? userLabel : assistantLabel}</Text>
            <Text style={[styles.bubbleTime, { color: softInkColor }]}>{formatTime(message.timestamp)}</Text>
          </View>
          {message.role === 'assistant' && message.content.trim() === '' ? (
            <SkeletonThinking inkColor={inkColor} text={thinkingText} />
          ) : (
            <Text style={[styles.bubbleText, { color: inkColor }]}>{message.content}</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function SkeletonThinking({ inkColor, text }: { inkColor: string; text: string }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.85, 0.25],
  });

  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.thinkingRow}>
        <ActivityIndicator size="small" color={inkColor} />
        <Text style={[styles.thinkingText, { color: inkColor }]}>{text}</Text>
      </View>
      <Animated.View style={[styles.skeletonLineLg, { opacity }]} />
      <Animated.View style={[styles.skeletonLineMd, { opacity }]} />
      <Animated.View style={[styles.skeletonLineSm, { opacity }]} />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  color,
  borderColor,
  textColor,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
  borderColor: string;
  textColor: string;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  function animateTo(next: number) {
    Animated.spring(pressScale, {
      toValue: next,
      speed: 30,
      bounciness: 8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.965)}
      onPressOut={() => animateTo(1)}
      style={disabled ? styles.buttonDisabled : undefined}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: color, borderColor },
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ToolTextButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.toolButton}>
      <Text style={[styles.toolButtonText, { color }, disabled && styles.toolButtonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
  color,
  enabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  color: string;
  enabled: boolean;
}) {
  const scale = useRef(new Animated.Value(active ? 1.05 : 1)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(active ? 1.05 : 1);
      return;
    }
    Animated.spring(scale, {
      toValue: active ? 1.08 : 1,
      speed: 22,
      bounciness: 8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [active, enabled, scale]);

  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <Ionicons name={icon} size={18} color={color} style={{ opacity: active ? 1 : 0.68 }} />
        <Text style={[styles.tabButtonText, { color, opacity: active ? 1 : 0.68 }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractHermesVersion(payload: unknown): string | null {
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

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  safeAreaWeb: {
    overflow: 'hidden',
  },
  webStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  bgBlobTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 120,
    opacity: 0.65,
  },
  bgBlobBottom: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 120,
    opacity: 0.55,
  },
  mainWrap: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH },
  keyboardAvoidingView: { flex: 1 },
  container: { padding: 16, paddingTop: 50, paddingBottom: 110, gap: 12 },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: borderWidths.thick,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0px 2px 4px rgba(115, 75, 40, 0.08)',
    elevation: 1,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: radii.md,
    borderWidth: borderWidths.thick,
    backgroundColor: '#fff',
  },
  heroTextWrap: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },
  card: {
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: borderWidths.thick,
    gap: 8,
    boxShadow: '0px 1px 2px rgba(89, 66, 45, 0.05)',
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: borderWidths.thick, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: borderWidths.thick },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontWeight: '700' },
  hint: { fontSize: 13 },
  connectionItem: {
    borderWidth: borderWidths.thick,
    borderRadius: radii.md,
    padding: 10,
    gap: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionMainArea: {
    flex: 1,
    gap: 2,
  },
  connectionEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9b7c5f',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  connectionEditText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectionName: { fontWeight: '700' },
  connectionMeta: { fontSize: 12 },
  heroStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  foldToggleText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  floatingBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center', justifyContent: 'center' },
  floatingBar: {
    width: '100%',
    maxWidth: WEB_MAX_WIDTH - 48,
    borderRadius: radii.round,
    borderWidth: borderWidths.thick,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    boxShadow: '0px 4px 8px rgba(0,0,0,0.12)',
    elevation: 5,
  },
  tabButton: { minWidth: 70, alignItems: 'center' },
  tabButtonText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  chatButtonPlaceholder: { width: 88 },
  chatFab: {
    position: 'absolute',
    top: -16,
    minWidth: 88,
    height: 52,
    borderRadius: 26,
    borderWidth: borderWidths.thick,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0px 4px 8px rgba(0,0,0,0.16)',
    elevation: 6,
  },
  chatFabDisabled: {
    opacity: 1,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.08)',
    elevation: 2,
  },
  chatFabText: { fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center' },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  chatSheetAvoid: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight:'80%',
    minHeight:'60%',
    bottom: 0,
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
    alignSelf: 'center',
    zIndex: 2,
    elevation: 8,
  },
  chatSheetAvoidWeb: {
    left: undefined,
    right: undefined,
    width: '100%',
    height: '100%',
    margin:'auto',
    // maxWidth: WEB_MAX_WIDTH,
    alignSelf: 'center',
  },
  chatSheet: {
   
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: borderWidths.thick,
    borderBottomWidth: 0,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 14,
    gap: 8,
    height: '100%',
    width: '100%',
    marginBottom: 0,
  },
  chatSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  thinkingChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  phaseText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  stepsPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepsToggle: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepsList: {
    marginTop: 8,
    gap: 5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepIndex: {
    width: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  stepName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  stepStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  chatToolsRow: { flexDirection: 'row', gap: 10 },
  toolButton: { paddingVertical: 2 },
  toolButtonText: { fontSize: 12, fontWeight: '700' },
  toolButtonTextDisabled: { color: '#b59e87' },
  chatBox: { borderWidth: borderWidths.thick, borderRadius: radii.md, minHeight: 220, backgroundColor: '#fffefc' },
  chatBoxContent: { padding: 10, gap: 8 },
  chatComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInputInlineGrow: {
    flex: 1,
  },
  bubbleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  userBubbleRow: {
    justifyContent: 'flex-end',
  },
  assistantBubbleRow: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#00000022',
    backgroundColor: '#fff',
    marginBottom: 2,
  },
  bubble: { borderRadius: radii.md, borderWidth: borderWidths.thick, padding: 10 },
  userBubbleWrap: {
    maxWidth: '72%',
    minWidth: '28%',
  },
  assistantBubbleWrap: {
    maxWidth: '84%',
    minWidth: '30%',
  },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bubbleRole: { fontSize: 12, fontWeight: '700' },
  bubbleTime: { fontSize: 11, fontWeight: '600' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  skeletonWrap: {
    gap: 8,
    paddingVertical: 2,
  },
  skeletonLineLg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#00000022',
    width: '92%',
  },
  skeletonLineMd: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#00000018',
    width: '78%',
  },
  skeletonLineSm: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#00000014',
    width: '56%',
  },
  settingLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  versionRow: {
    gap: 2,
  },
  helpBox: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 8,
    gap: 4,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 17,
  },
  contactLinkButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  contactLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
