import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";

interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  back?: boolean;
  action?: React.ReactNode;
}

export function AppHeader({ title, eyebrow, back = true, action }: AppHeaderProps) {
  const router = useRouter();
  const { t } = useApp();
  return (
    <View style={styles.row}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.line
  },
  backText: { color: colors.cream, fontSize: 34, lineHeight: 36, marginTop: -3 },
  titleWrap: { flex: 1 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.cream, fontSize: 27, fontWeight: "900", letterSpacing: -0.5 }
});
