import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { AppHeader } from "../../components/AppHeader";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { useApp } from "../../state/AppContext";
import { useGame } from "../../state/GameContext";
import { colors, radius, spacing } from "../../theme/tokens";

export default function LocalSetupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, settings } = useApp();
  const { startLocal } = useGame();
  const defaults = settings.language === "ko" ? ["플레이어 1", "플레이어 2", "플레이어 3"] : ["Player 1", "Player 2", "Player 3"];
  const [names, setNames] = useState<[string, string, string]>(defaults as [string, string, string]);
  const valid = useMemo(() => names.every((name) => name.trim().length > 0), [names]);
  const wide = width >= 700;

  const setName = (index: number, name: string) => setNames((current) => current.map((value, id) => id === index ? name : value) as [string, string, string]);
  const start = () => {
    const sessionId = startLocal(names.map((name) => name.trim()) as [string, string, string]);
    router.replace({ pathname: "/game/[sessionId]", params: { sessionId } });
  };

  return (
    <Screen>
      <AppHeader title={t("local")} eyebrow="PASS & PLAY · 한 기기" />
      <View style={[styles.layout, wide && styles.layoutWide]}>
        <View style={styles.form}>
          {names.map((name, index) => (
            <View key={index} style={styles.playerRow}>
              <View style={[styles.seat, index === 0 && styles.seatDealer]}><Text style={styles.seatText}>{index + 1}</Text></View>
              <View style={styles.field}><FormField label={`${settings.language === "ko" ? "플레이어" : "Player"} ${index + 1}`} value={name} maxLength={16} onChangeText={(text) => setName(index, text)} /></View>
            </View>
          ))}
        </View>
        <View style={styles.side}>
          <Text style={styles.sideTitle}>One device, private hands</Text>
          <Text style={styles.sideBody}>After every turn, an opaque handoff curtain hides the next player’s cards. Hold to reveal only when the device reaches them.</Text>
          <View style={styles.ruleRow}><Text style={styles.ruleValue}>50</Text><Text style={styles.ruleLabel}>{t("chips")} / player</Text></View>
          <View style={styles.ruleRow}><Text style={styles.ruleValue}>1</Text><Text style={styles.ruleLabel}>chip ante / round</Text></View>
          <AppButton label={t("start")} onPress={start} disabled={!valid} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.xl },
  layoutWide: { flexDirection: "row", alignItems: "stretch" },
  form: { flex: 1.25, gap: spacing.lg, backgroundColor: "rgba(255,255,255,0.035)", padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  seat: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.feltLight, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  seatDealer: { backgroundColor: colors.vermilion, borderColor: colors.gold },
  seatText: { color: colors.cream, fontSize: 16, fontWeight: "900" },
  field: { flex: 1 },
  side: { flex: 0.8, gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.felt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  sideTitle: { color: colors.cream, fontSize: 20, fontWeight: "900" },
  sideBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  ruleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  ruleValue: { color: colors.gold, fontSize: 28, fontWeight: "900" },
  ruleLabel: { color: colors.paperMuted, fontSize: 13, fontWeight: "700" }
});
