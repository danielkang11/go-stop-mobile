import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { Screen } from "../components/Screen";
import { useApp } from "../state/AppContext";
import { useGame } from "../state/GameContext";
import { colors, radius, spacing } from "../theme/tokens";

export default function RoundSummaryScreen() {
  const router = useRouter();
  const { t } = useApp();
  const { view, dispatch, busy, reset } = useGame();
  const summary = view?.roundSummary;
  const winner = summary?.winnerSeatId !== undefined ? view?.seats[summary.winnerSeatId] : undefined;
  const nextAction = view?.legalActions.find((action) => action.kind === "next-round");

  useEffect(() => {
    if (view?.phase === "playing") {
      router.replace({ pathname: "/game/[sessionId]", params: { sessionId: view.sessionId } });
    }
  }, [router, view?.phase, view?.sessionId]);

  if (!view) return null;
  const next = async () => {
    if (!nextAction) return;
    if (await dispatch(nextAction)) router.replace({ pathname: "/game/[sessionId]", params: { sessionId: view.sessionId } });
  };
  const end = () => { reset(); router.replace("/"); };

  return (
    <Screen contentStyle={styles.screen}>
      <Text style={styles.eyebrow}>ROUND {view.roundNumber} · 결과</Text>
      <View style={styles.hero}>
        <View style={styles.winnerDisc}><Text style={styles.crown}>{summary?.nagari ? "↻" : "勝"}</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{summary?.nagari ? "나가리 · No winner" : `${winner?.name ?? summary?.winnerName ?? "Winner"} wins`}</Text>
        <Text style={styles.score}>{summary?.baseScore ?? winner?.score ?? 0} base · {summary?.payableScore ?? winner?.score ?? 0} payable</Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>SCORE · 점수</Text>
          {summary?.scoreLines.length ? summary.scoreLines.map((line, index) => <ResultRow key={`${line.label}-${index}`} label={`${line.labelKo} · ${line.label}`} value={`+${line.points}`} />) : <Text style={styles.empty}>Score details are included in the engine ledger.</Text>}
          <View style={styles.total}><Text style={styles.totalLabel}>PAYABLE</Text><Text style={styles.totalValue}>{summary?.payableScore ?? winner?.score ?? 0}</Text></View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>SETTLEMENT · 정산</Text>
          {summary?.payments.length ? summary.payments.map((payment, index) => (
            <View key={`${payment.from}-${index}`} style={styles.payment}>
              <View><Text style={styles.paymentName}>{payment.from}</Text><Text style={styles.requested}>owed {payment.requested}{payment.shortfall ? ` · short ${payment.shortfall}` : ""}</Text></View>
              <Text style={styles.paid}>−{payment.paid}</Text>
            </View>
          )) : <Text style={styles.empty}>{summary?.nagari ? "No point payments. The next-round multiplier increases." : "No payment breakdown available."}</Text>}
          {summary?.potAward ? <View style={styles.potAward}><Text style={styles.boar}>🐗</Text><Text style={styles.potText}>{summary.potAward.player} claimed the pot</Text><Text style={styles.potValue}>+{summary.potAward.chips}</Text></View> : <Text style={styles.carry}>🐗 Pot carried: {summary?.potCarried ?? view.pot}</Text>}
        </View>
      </View>

      <View style={styles.wallets}>{view.seats.map((seat, index) => <View key={seat.id} style={styles.wallet}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.walletName}>{seat.name}</Text><Text style={styles.walletValue}>● {seat.chips}</Text></View>)}</View>
      <View style={styles.actions}>
        <AppButton style={styles.primary} label={!nextAction && view.mode === "remote" ? "Waiting for dealer…" : t("nextRound")} onPress={() => void next()} loading={busy} disabled={!nextAction} />
        <AppButton variant="ghost" label={t("endSession")} onPress={end} />
      </View>
    </Screen>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 880, gap: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.6, textAlign: "center" },
  hero: { alignItems: "center" },
  winnerDisc: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: colors.vermilion, borderWidth: 3, borderColor: colors.gold },
  crown: { color: colors.white, fontSize: 28, fontWeight: "900" },
  title: { color: colors.cream, fontSize: 29, fontWeight: "900", marginTop: spacing.md, textAlign: "center" },
  score: { color: colors.paperMuted, fontSize: 13, fontWeight: "700", marginTop: 4 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  panel: { flex: 1, minWidth: 280, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  panelTitle: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { color: colors.paperMuted, fontSize: 12, fontWeight: "700" },
  rowValue: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: spacing.md },
  totalLabel: { color: colors.cream, fontSize: 11, fontWeight: "900" },
  totalValue: { color: colors.gold, fontSize: 25, fontWeight: "900" },
  payment: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  paymentName: { color: colors.cream, fontSize: 12, fontWeight: "800" },
  requested: { color: colors.muted, fontSize: 10, marginTop: 2 },
  paid: { color: colors.danger, fontSize: 16, fontWeight: "900" },
  potAward: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: "rgba(231,184,81,0.1)", borderRadius: radius.md, marginTop: spacing.md },
  boar: { fontSize: 18 },
  potText: { flex: 1, color: colors.paperMuted, fontSize: 11, fontWeight: "700" },
  potValue: { color: colors.gold, fontSize: 15, fontWeight: "900" },
  carry: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: spacing.md },
  empty: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  wallets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wallet: { flex: 1, minWidth: 180, minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.felt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  rank: { color: colors.muted, fontWeight: "900" },
  walletName: { flex: 1, color: colors.cream, fontSize: 12, fontWeight: "800" },
  walletValue: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  actions: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  primary: { flex: 1, maxWidth: 420 }
});
