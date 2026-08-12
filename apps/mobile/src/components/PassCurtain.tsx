import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UiGameView, UiSeatId } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";
import { BrandMark } from "./BrandMark";

export function PassCurtain({ view, seatId, onReveal }: { view: UiGameView; seatId: UiSeatId; onReveal: () => void }) {
  const { t } = useApp();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const player = view.seats[seatId];

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
    timer.current = undefined;
    interval.current = undefined;
    setProgress(0);
  };

  const begin = () => {
    const started = Date.now();
    interval.current = setInterval(() => setProgress(Math.min(1, (Date.now() - started) / 700)), 40);
    timer.current = setTimeout(() => {
      cancel();
      onReveal();
    }, 700);
  };

  useEffect(() => cancel, []);

  return (
    <View style={styles.curtain} accessibilityViewIsModal>
      <View style={styles.publicBar}>
        <Text style={styles.publicText}>Round {view.roundNumber}</Text>
        <Text style={styles.publicText}>🐗 {view.pot} chips</Text>
        <Text style={styles.publicText}>{view.stockCount} in stock</Text>
      </View>
      <BrandMark compact />
      <Text accessibilityRole="header" style={styles.title}>{t("passTitle")}</Text>
      <Text style={styles.player}>{player?.name ?? `Player ${seatId + 1}`}</Text>
      <Text style={styles.hint}>{t("privacyHint")}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("holdReveal")}, ${player?.name}`}
        accessibilityHint="Keep holding until the ring fills"
        onPressIn={begin}
        onPressOut={cancel}
        style={({ pressed }) => [styles.hold, pressed && styles.holdPressed]}
      >
        <View style={[styles.progress, { width: `${Math.max(8, progress * 100)}%` }]} />
        <Text style={styles.holdIcon}>◉</Text>
        <Text style={styles.holdText}>{t("holdReveal")}</Text>
      </Pressable>
      <View style={styles.wallets}>{view.seats.map((seat) => <Text key={seat.id} style={styles.wallet}>{seat.name}: <Text style={styles.walletValue}>{seat.chips}</Text></Text>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  curtain: { flex: 1, backgroundColor: colors.canvasDeep, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  publicBar: { position: "absolute", top: spacing.xl, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xl },
  publicText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  title: { color: colors.paperMuted, fontSize: 17, fontWeight: "800", marginTop: spacing.xl },
  player: { color: colors.cream, fontSize: 36, fontWeight: "900", letterSpacing: -0.8, marginTop: spacing.xs },
  hint: { color: colors.muted, textAlign: "center", fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.xl },
  hold: { width: "100%", maxWidth: 430, minHeight: 62, borderRadius: radius.pill, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, borderWidth: 2, borderColor: colors.gold, backgroundColor: colors.felt },
  holdPressed: { transform: [{ scale: 0.99 }] },
  progress: { position: "absolute", height: "100%", left: 0, backgroundColor: colors.vermilionDark },
  holdIcon: { color: colors.gold, fontSize: 19 },
  holdText: { color: colors.cream, fontSize: 15, fontWeight: "900" },
  wallets: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.lg, marginTop: spacing.xl },
  wallet: { color: colors.muted, fontSize: 11 },
  walletValue: { color: colors.gold, fontWeight: "900" }
});
