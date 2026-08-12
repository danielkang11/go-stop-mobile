import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { Screen } from "../components/Screen";
import { useApp, type AppSettings } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function SettingsScreen() {
  const { settings, updateSettings, t } = useApp();
  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title={t("settings")} eyebrow="ACCESSIBILITY · 접근성" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("language")}</Text>
        <View style={styles.languageRow}>
          {(["en", "ko"] as const).map((language) => (
            <Pressable key={language} accessibilityRole="radio" accessibilityState={{ selected: settings.language === language }} onPress={() => updateSettings({ language })} style={[styles.language, settings.language === language && styles.languageActive]}>
              <Text style={[styles.languageText, settings.language === language && styles.languageTextActive]}>{language === "en" ? "English" : "한국어"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <SettingRow label={t("motion")} description="Shorter transitions and no decorative movement" setting="reducedMotion" />
        <SettingRow label={t("contrast")} description="Stronger borders and clearer turn markers" setting="highContrast" />
        <SettingRow label={t("cardZoom")} description="Long-press any face-up card for a large preview" setting="cardZoom" />
      </View>
      <View style={styles.section}>
        <SettingRow label={t("haptics")} description="Gentle feedback for actions and turn changes" setting="haptics" />
        <SettingRow label={t("sound")} description="Card, capture, and result sounds" setting="sound" />
      </View>
      <Text style={styles.note}>Screen capture is blocked while a private local hand is visible where the operating system permits. External cameras and shoulder-surfing cannot be prevented.</Text>
    </Screen>
  );
}

function SettingRow({ label, description, setting }: { label: string; description: string; setting: keyof Omit<AppSettings, "language"> }) {
  const { settings, updateSettings } = useApp();
  return (
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.description}>{description}</Text></View>
      <Switch accessibilityLabel={label} value={settings[setting]} onValueChange={(value) => updateSettings({ [setting]: value })} thumbColor={settings[setting] ? colors.gold : colors.paperMuted} trackColor={{ false: colors.felt, true: colors.vermilionDark }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 760 },
  section: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.035)", overflow: "hidden", marginBottom: spacing.lg },
  sectionTitle: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", padding: spacing.lg, paddingBottom: 0 },
  languageRow: { flexDirection: "row", padding: spacing.lg, gap: spacing.sm },
  language: { flex: 1, minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  languageActive: { borderColor: colors.gold, backgroundColor: "rgba(231,184,81,0.1)" },
  languageText: { color: colors.paperMuted, fontWeight: "800" },
  languageTextActive: { color: colors.gold },
  row: { minHeight: 74, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  copy: { flex: 1 },
  label: { color: colors.cream, fontSize: 15, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: spacing.xl }
});
