import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { UiAction, UiGameView } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";
import { AppButton } from "./AppButton";
import { HwatuCard } from "./HwatuCard";

export function ChoiceSheet({ view, busy, onChoose }: { view: UiGameView; busy: boolean; onChoose: (action: UiAction) => void }) {
  const { t, settings } = useApp();
  const actions = view.legalActions;
  if (view.pendingChoice === "match") {
    const choices = actions.filter((action) => action.kind === "choose-match");
    return (
      <Modal transparent animationType={settings.reducedMotion ? "none" : "slide"} visible>
        <View style={styles.backdrop} accessibilityViewIsModal>
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.title}>{t("chooseMatch")}</Text>
            <Text style={styles.body}>{t("chooseMatchBody")}</Text>
            <View style={styles.cards}>
              {choices.map((action) => {
                const card = view.table.find((item) => item.id === action.cardId || item.id === action.targetCardId);
                return card ? <HwatuCard key={action.id} card={card} onPress={() => onChoose(action)} disabled={busy} /> : <AppButton key={action.id} label={settings.language === "ko" ? action.labelKo : action.label} onPress={() => onChoose(action)} disabled={busy} />;
              })}
            </View>
          </View>
        </View>
      </Modal>
    );
  }
  if (view.pendingChoice === "go-stop") {
    const go = actions.find((action) => action.kind === "go");
    const stop = actions.find((action) => action.kind === "stop");
    const player = view.seats[view.activeSeatId];
    return (
      <Modal transparent animationType={settings.reducedMotion ? "none" : "slide"} visible>
        <View style={styles.backdrop} accessibilityViewIsModal>
          <View style={styles.sheet}>
            <View style={styles.scoreDisc}><Text style={styles.scoreNumber}>{player?.score ?? 0}</Text><Text style={styles.scoreLabel}>{t("score")}</Text></View>
            <Text accessibilityRole="header" style={styles.title}>{t("chooseGoStop")}</Text>
            <Text style={styles.warning}>{t("goWarning")}</Text>
            <View style={styles.actions}>
              {stop ? <AppButton style={styles.action} label={t("stop")} caption="Bank the round now" onPress={() => onChoose(stop)} disabled={busy} /> : null}
              {go ? <AppButton style={styles.action} variant="secondary" label={t("go")} caption="Continue with added risk" onPress={() => onChoose(go)} disabled={busy} /> : null}
            </View>
          </View>
        </View>
      </Modal>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end", padding: spacing.md },
  sheet: { width: "100%", maxWidth: 680, alignSelf: "center", backgroundColor: colors.felt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, padding: spacing.xl, alignItems: "center" },
  title: { color: colors.cream, fontSize: 24, fontWeight: "900", textAlign: "center" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: spacing.sm },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: spacing.sm },
  cards: { minHeight: 120, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xl, marginTop: spacing.xl },
  scoreDisc: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.vermilion, borderWidth: 3, borderColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: -54, marginBottom: spacing.md },
  scoreNumber: { color: colors.white, fontSize: 25, lineHeight: 27, fontWeight: "900" },
  scoreLabel: { color: colors.paper, fontSize: 9, fontWeight: "900" },
  actions: { width: "100%", flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  action: { flex: 1 }
});
