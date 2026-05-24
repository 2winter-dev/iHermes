import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SimpleMarkdown } from './simple_markdown';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type BubbleMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
};

export function AnimatedMessageBubble({
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
  processEntries,
  showProcessDetails,
  isProgressHost,
  toolLabel,
}: {
  message: BubbleMessage;
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
  processEntries?: Array<{ id: string; text: string; timestamp: string }>;
  showProcessDetails?: boolean;
  isProgressHost?: boolean;
  toolLabel: string;
}) {
  const fade = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const slide = useRef(new Animated.Value(enabled ? 10 : 0)).current;
  const [processExpanded, setProcessExpanded] = useState(false);

  useEffect(() => {
    setProcessExpanded(false);
  }, [message.id]);

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

  const roleLabel =
    message.role === 'user'
      ? userLabel
      : message.role === 'tool'
      ? toolLabel
      : assistantLabel;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={[styles.bubbleRow, message.role === 'user' ? styles.userBubbleRow : styles.assistantBubbleRow]}>
        {message.role === 'assistant' ? (
          <Image source={require('../../assets/hermes-logo.png')} style={styles.assistantAvatar} />
        ) : null}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={280}
          style={[
            styles.bubble,
            message.role === 'user' ? styles.userBubbleWrap : styles.assistantBubbleWrap,
            message.role === 'assistant' && isProgressHost ? styles.assistantBubbleStreaming : null,
            { borderColor, backgroundColor: message.role === 'user' ? userBubble : assistantBubble },
          ]}
        >
          <View style={styles.bubbleHeader}>
            <Text style={[styles.bubbleRole, { color: softInkColor }]}>{roleLabel}</Text>
            <Text style={[styles.bubbleTime, { color: softInkColor }]}>{formatTime(message.timestamp)}</Text>
          </View>
          {message.role === 'assistant' && message.content.trim() === '' ? (
            <SkeletonThinking inkColor={inkColor} text={thinkingText} />
          ) : (
            <SimpleMarkdown content={message.content} inkColor={inkColor} softInkColor={softInkColor} />
          )}
          {message.role === 'assistant' && showProcessDetails && (processEntries?.length ?? 0) > 0 ? (
            <View style={styles.progressWrap}>
              <Pressable style={styles.progressHeader} onPress={() => setProcessExpanded((v) => !v)}>
                <Text style={[styles.progressHeaderIcon, { color: softInkColor }]}>{processExpanded ? '▾' : '▸'}</Text>
                <Text style={[styles.progressHeaderText, { color: softInkColor }]}>
                  {isProgressHost ? '调用过程（进行中）' : '调用过程'} · {processEntries?.length ?? 0}
                </Text>
              </Pressable>
              {processExpanded ? (
                <View style={styles.progressContent} >
                  {processEntries?.map((entry) => (
                    <View key={entry.id} style={styles.progressRow}>
                      <Text style={[styles.progressTime, { color: softInkColor }]}>{formatTime(entry.timestamp)}</Text>
                      {entry.text.includes('\n') ? (
                        <View style={styles.progressDetailBlock}>
                          <Text style={[styles.progressDetailText, { color: inkColor }]}>{entry.text}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.progressText, { color: inkColor }]}>{entry.text}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
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

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const styles = StyleSheet.create({
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
  bubble: { borderRadius: 12, borderWidth: 2, padding: 10 },
  userBubbleWrap: {
    maxWidth: '72%',
    minWidth: '28%',
  },
  assistantBubbleWrap: {
    maxWidth: '92%',
    minWidth: '36%',
  },
  assistantBubbleStreaming: {
    width: '92%',
  },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bubbleRole: { fontSize: 12, fontWeight: '700' },
  bubbleTime: { fontSize: 11, fontWeight: '600' },
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
  progressWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#00000012',
    paddingTop: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  progressHeaderIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContent: {
    maxHeight:1200,
    overflow: 'hidden',
  },
  progressList: {
    gap: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  progressTime: {
    width: 36,
    fontSize: 11,
    fontWeight: '600',
  },
  progressText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  progressDetailBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#00000020',
    borderRadius: 8,
    backgroundColor: '#00000008',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  progressDetailText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
