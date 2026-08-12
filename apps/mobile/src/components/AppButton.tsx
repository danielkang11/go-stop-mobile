import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle
} from "react-native";

import { useApp } from "../state/AppContext";
import { colors, radius, shadow, spacing } from "../theme/tokens";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  caption?: string;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function AppButton({
  label,
  onPress,
  caption,
  icon,
  variant = "primary",
  disabled,
  loading,
  style,
  accessibilityHint
}: AppButtonProps) {
  const { settings } = useApp();
  const trigger = () => {
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? caption}
      disabled={disabled || loading}
      onPress={trigger}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View style={styles.copy}>
        <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : null]}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.arrow}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    ...shadow
  },
  primary: { backgroundColor: colors.vermilion, borderColor: "#EC796C" },
  secondary: { backgroundColor: colors.feltLight, borderColor: colors.line },
  ghost: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: colors.line, shadowOpacity: 0 },
  danger: { backgroundColor: colors.vermilionDark, borderColor: colors.danger },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  icon: { fontSize: 25, color: colors.cream, width: 30, textAlign: "center" },
  copy: { flex: 1 },
  label: { color: colors.cream, fontSize: 17, fontWeight: "800", letterSpacing: 0.1 },
  primaryLabel: { color: colors.white },
  caption: { marginTop: 2, color: colors.muted, fontSize: 13, lineHeight: 18 },
  arrow: { color: colors.gold, fontSize: 28, fontWeight: "300" }
});
