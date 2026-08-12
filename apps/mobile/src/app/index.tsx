import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { BrandMark } from "../components/BrandMark";
import { Screen } from "../components/Screen";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, settings, updateSettings } = useApp();
  const wide = width >= 760;

  return (
    <Screen contentStyle={[styles.screen, wide && styles.screenWide]}>
      <View style={[styles.hero, wide && styles.heroWide]}>
        <BrandMark />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>THREE-PLAYER · 3인용</Text>
          <Text accessibilityRole="header" style={styles.title}>{t("appName")}</Text>
          <Text style={styles.subtitle}>{t("appTagline")}</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}><Text style={styles.chipNumber}>50</Text></View>
            <Text style={styles.chipCopy}>50 {t("chips")} each · 1-chip ante · 🐗 {t("centralPot")}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.menu, wide && styles.menuWide]}>
        <View style={styles.primaryActions}>
          <AppButton icon="↻" label={t("local")} caption={t("localCaption")} onPress={() => router.push("/local/setup")} />
          <AppButton icon="✦" variant="secondary" label={t("ai")} caption={t("aiCaption")} onPress={() => router.push("/ai/setup")} />
          <AppButton icon="⌁" variant="secondary" label={t("online")} caption={t("onlineCaption")} onPress={() => router.push("/online")} />
        </View>
        <View style={styles.utilityActions}>
          <AppButton icon="冊" variant="ghost" label={t("rules")} onPress={() => router.push("/rules")} />
          <AppButton icon="⚙" variant="ghost" label={t("settings")} onPress={() => router.push("/settings")} />
          <AppButton
            icon="한"
            variant="ghost"
            label={settings.language === "en" ? "한국어로 보기" : "View in English"}
            onPress={() => updateSettings({ language: settings.language === "en" ? "ko" : "en" })}
          />
        </View>
      </View>

      <Text style={styles.disclaimer}>{t("noCash")} · MVP rules v2</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "space-between", gap: spacing.xl },
  screenWide: { paddingVertical: spacing.xxl },
  hero: { alignItems: "center", gap: spacing.xl, paddingTop: spacing.lg },
  heroWide: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 0 },
  heroCopy: { maxWidth: 560, alignItems: "center" },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 2.2, fontWeight: "900", marginBottom: spacing.sm },
  title: { color: colors.cream, fontSize: 42, lineHeight: 48, fontWeight: "900", textAlign: "center", letterSpacing: -1.4 },
  subtitle: { color: colors.muted, marginTop: spacing.sm, textAlign: "center", fontSize: 16, lineHeight: 23 },
  chipRow: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: spacing.lg },
  chip: { width: 37, height: 37, borderRadius: 19, backgroundColor: colors.vermilion, borderWidth: 3, borderColor: colors.paper, alignItems: "center", justifyContent: "center" },
  chipNumber: { color: colors.white, fontWeight: "900", fontSize: 12 },
  chipCopy: { color: colors.paperMuted, fontSize: 12, fontWeight: "700" },
  menu: { gap: spacing.md },
  menuWide: { flexDirection: "row", alignItems: "stretch" },
  primaryActions: { flex: 1.25, gap: spacing.md },
  utilityActions: { flex: 0.75, gap: spacing.md },
  disclaimer: { color: colors.muted, textAlign: "center", fontSize: 11, marginTop: spacing.sm }
});
