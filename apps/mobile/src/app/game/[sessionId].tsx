import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { GameTable } from "../../components/GameTable";
import { PassCurtain } from "../../components/PassCurtain";
import { Screen } from "../../components/Screen";
import { useApp } from "../../state/AppContext";
import { useGame } from "../../state/GameContext";
import { colors, spacing } from "../../theme/tokens";

export default function GameScreen() {
  const router = useRouter();
  const { t } = useApp();
  const { view, busy, error, curtainSeat, dispatch, revealHand, reset } = useGame();

  useEffect(() => {
    if (view?.phase === "round-summary") router.replace("/round-summary");
    if (view?.phase === "session-summary") router.replace("/session-summary");
  }, [router, view?.phase]);

  if (!view) {
    return (
      <Screen contentStyle={styles.missing}>
        <Text style={styles.title}>Session not available</Text>
        <Text style={styles.body}>Local games live in memory to protect concealed hands. Start a new table from Home.</Text>
        <AppButton label={t("home")} onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (curtainSeat !== undefined) return <PassCurtain view={view} seatId={curtainSeat} onReveal={revealHand} />;

  const leave = () => {
    reset();
    router.replace("/");
  };
  return <GameTable view={view} busy={busy} error={error} onAction={(action) => void dispatch(action)} onLeave={leave} />;
}

const styles = StyleSheet.create({
  missing: { maxWidth: 520, justifyContent: "center", alignItems: "center", gap: spacing.lg },
  title: { color: colors.cream, fontSize: 25, fontWeight: "900", textAlign: "center" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" }
});
