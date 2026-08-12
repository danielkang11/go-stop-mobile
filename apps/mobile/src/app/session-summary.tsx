import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { BrandMark } from "../components/BrandMark";
import { Screen } from "../components/Screen";
import { useApp } from "../state/AppContext";
import { useGame } from "../state/GameContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function SessionSummaryScreen() {
  const router = useRouter();
  const { t } = useApp();
  const { view, reset } = useGame();
  if (!view) return null;
  const ranked = [...view.seats].sort((a, b) => b.chips - a.chips);
  const home = () => { reset(); router.replace("/"); };
  return (
    <Screen contentStyle={styles.screen}>
      <BrandMark compact />
      <Text style={styles.eyebrow}>FINAL TABLE · 최종 결과</Text>
      <Text accessibilityRole="header" style={styles.title}>{t("sessionComplete")}</Text>
      <Text style={styles.reason}>{view.sessionEndReason ?? "A player cannot cover the next 1-chip ante."}</Text>
      <View style={styles.podium}>
        {ranked.map((seat, index) => <View key={seat.id} style={[styles.result, index === 0 && styles.first]}><Text style={styles.place}>{index === 0 ? "勝" : index + 1}</Text><View style={styles.resultCopy}><Text style={styles.name}>{seat.name}</Text><Text style={styles.detail}>{seat.score} points this round</Text></View><Text style={styles.chips}>● {seat.chips}</Text></View>)}
      </View>
      <View style={styles.actions}><AppButton style={styles.action} label={t("playAgain")} onPress={home} /><AppButton variant="ghost" label={t("home")} onPress={home} /></View>
      <Text style={styles.noCash}>{t("noCash")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 680, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginTop: spacing.lg },
  title: { color: colors.cream, fontSize: 32, fontWeight: "900", marginTop: spacing.sm },
  reason: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
  podium: { width: "100%", gap: spacing.sm, marginVertical: spacing.xl },
  result: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.035)" },
  first: { borderColor: colors.gold, backgroundColor: "rgba(231,184,81,0.1)" },
  place: { width: 42, height: 42, lineHeight: 42, borderRadius: 21, textAlign: "center", overflow: "hidden", color: colors.cream, backgroundColor: colors.vermilion, fontWeight: "900", fontSize: 16 },
  resultCopy: { flex: 1 },
  name: { color: colors.cream, fontSize: 16, fontWeight: "900" },
  detail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  chips: { color: colors.gold, fontSize: 18, fontWeight: "900" },
  actions: { width: "100%", flexDirection: "row", gap: spacing.md },
  action: { flex: 1 },
  noCash: { color: colors.muted, fontSize: 10, marginTop: spacing.lg }
});
