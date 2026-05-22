import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function AnimatedCard({
  children,
  delay,
  enabled,
}: {
  children: ReactNode;
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

export function ActionButton({
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

export function ToolTextButton({
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

export function TabButton({
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

const styles = StyleSheet.create({
  button: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 2 },
  buttonDisabled: { opacity: 0.55 } as ViewStyle,
  buttonText: { fontWeight: '700' },
  toolButton: { paddingVertical: 2 },
  toolButtonText: { fontSize: 12, fontWeight: '700' },
  toolButtonTextDisabled: { color: '#b59e87' },
  tabButton: { minWidth: 70, alignItems: 'center' },
  tabButtonText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
