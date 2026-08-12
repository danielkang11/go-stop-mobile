import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { UiAction, UiCard, UiGameView, UiSeat } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";
import { CapturedSpread } from "./CapturedSpread";
import { CentralTableField } from "./CentralTableField";
import { ChoiceSheet } from "./ChoiceSheet";
import { HwatuCard } from "./HwatuCard";
import { PlayerBadge } from "./PlayerBadge";

interface GameTableProps {
  view: UiGameView;
  busy: boolean;
  error?: string | undefined;
  onAction: (action: UiAction) => void;
  onLeave: () => void;
}

export function GameTable({ view, busy, error, onAction, onLeave }: GameTableProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { t, settings } = useApp();
  const landscape = width > height || width >= 780;
  const compactLandscape = landscape && height < 430;
  const current = view.seats[view.activeSeatId];
  const viewer = view.seats[view.viewerSeatId];
  const opponents = orderOpponents(view);
  const cardActions = view.legalActions.filter((action) => action.kind === "play-card");
  const utilityActions = view.legalActions.filter((action) => ["bomb", "shake", "skip", "other"].includes(action.kind));
  const humanTurn = view.activeSeatId === view.viewerSeatId;
  const thinking = view.mode === "human-vs-ai" && !humanTurn;
  const playFor = (card: UiCard) => cardActions.find((action) => action.cardId === card.id);
  const actionLabel = (action: UiAction) => settings.language === "ko" ? action.labelKo : action.label;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, compactLandscape && styles.topBarCompact]}>
        <View style={styles.round}>
          <Text style={styles.roundLabel}>ROUND</Text>
          <Text style={styles.roundNumber}>{view.roundNumber}</Text>
        </View>
        <View style={styles.topCenter}>
          <Text style={styles.gameName}>GO · STOP</Text>
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {thinking ? `${current?.name} is thinking…` : `${current?.name} · ${t("turn")}`}
          </Text>
        </View>
        <View style={styles.topActions}>
          <View accessibilityLabel={`${t("centralPot")}, ${view.pot} chips`} style={styles.pot}>
            <Text style={styles.potIcon}>🐗</Text><Text style={styles.potValue}>{view.pot}</Text>
          </View>
          <Text accessibilityRole="button" accessibilityLabel={t("rules")} onPress={() => router.push("/rules")} style={styles.iconButton}>?</Text>
          <Text accessibilityRole="button" accessibilityLabel={t("leave")} onPress={onLeave} style={styles.iconButton}>×</Text>
        </View>
      </View>

      <View style={[styles.tableBand, !landscape && styles.tableBandPortrait]}>
        {landscape ? (
          <>
            <PlayerRail seat={opponents[0]} compact={compactLandscape} />
            <CentralTableField view={view} />
            <PlayerRail seat={opponents[1]} compact={compactLandscape} />
          </>
        ) : (
          <>
            <View style={styles.portraitOpponents}>
              <PlayerRail seat={opponents[0]} compact portrait />
              <PlayerRail seat={opponents[1]} compact portrait />
            </View>
            <CentralTableField view={view} />
          </>
        )}
      </View>

      <View style={[styles.bottomDock, !landscape && styles.bottomDockPortrait, compactLandscape && styles.bottomDockCompact]}>
        <View style={[styles.viewerZone, !landscape && styles.viewerZonePortrait]}>
          {viewer ? <PlayerBadge seat={viewer} compact /> : null}
          {viewer ? <CapturedSpread seat={viewer} orientation="dock" /> : null}
        </View>
        <View style={styles.handArea}>
          <View style={styles.handHead}>
            <Text style={styles.sectionLabel}>{t("yourHand")} · {viewer?.name}</Text>
            {utilityActions.length ? (
              <ScrollView horizontal contentContainerStyle={styles.utilities} showsHorizontalScrollIndicator={false}>
                {utilityActions.map((action) => (
                  <Text
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy }}
                    key={action.id}
                    onPress={() => !busy && onAction(action)}
                    style={styles.utility}
                  >
                    {actionLabel(action)}
                  </Text>
                ))}
              </ScrollView>
            ) : null}
          </View>
          <ScrollView horizontal contentContainerStyle={styles.hand} showsHorizontalScrollIndicator={false}>
            {view.hand.map((card) => {
              const action = playFor(card);
              return (
                <HwatuCard
                  key={card.id}
                  card={card}
                  compact={compactLandscape}
                  disabled={!action || busy || !humanTurn || Boolean(view.pendingChoice)}
                  onPress={action ? () => onAction(action) : undefined}
                />
              );
            })}
            {view.hand.length === 0 ? <Text style={styles.empty}>{thinking ? "AI turn in progress…" : "No cards in hand"}</Text> : null}
          </ScrollView>
        </View>
      </View>

      {error ? <View style={styles.errorToast}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text></View> : null}
      <ChoiceSheet view={view} busy={busy} onChoose={onAction} />
    </View>
  );
}

function orderOpponents(view: UiGameView): [UiSeat | undefined, UiSeat | undefined] {
  const next = ((view.viewerSeatId + 1) % 3) as 0 | 1 | 2;
  const previous = ((view.viewerSeatId + 2) % 3) as 0 | 1 | 2;
  return [view.seats[next], view.seats[previous]];
}

function PlayerRail({ seat, compact, portrait = false }: { seat?: UiSeat | undefined; compact: boolean; portrait?: boolean }) {
  if (!seat) return <View style={styles.playerRail} />;
  return (
    <View style={[styles.playerRail, compact && styles.playerRailCompact, portrait && styles.playerRailPortrait]}>
      <PlayerBadge seat={seat} compact />
      <CapturedSpread seat={seat} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvasDeep },
  topBar: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(3,18,14,0.94)"
  },
  topBarCompact: { minHeight: 48 },
  round: { flexDirection: "row", alignItems: "baseline", gap: 5, minWidth: 76 },
  roundLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  roundNumber: { color: colors.cream, fontSize: 20, fontWeight: "900" },
  topCenter: { flex: 1, alignItems: "center" },
  gameName: { color: colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2.2 },
  status: { color: colors.paperMuted, fontSize: 10, fontWeight: "700", marginTop: 2 },
  topActions: { minWidth: 76, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: spacing.sm },
  pot: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(231,184,81,0.12)", borderWidth: 1, borderColor: "rgba(231,184,81,0.35)", borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  potIcon: { fontSize: 14 },
  potValue: { color: colors.gold, fontSize: 14, fontWeight: "900" },
  iconButton: { width: 36, height: 36, lineHeight: 34, borderRadius: 18, textAlign: "center", color: colors.paperMuted, borderWidth: 1, borderColor: colors.line, fontSize: 18, overflow: "hidden" },
  tableBand: { flex: 1, minHeight: 190, flexDirection: "row", alignItems: "stretch" },
  tableBandPortrait: { minHeight: 390, flexDirection: "column" },
  portraitOpponents: { minHeight: 158, flexDirection: "row", alignItems: "stretch" },
  playerRail: { width: 172, justifyContent: "center", gap: 3, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  playerRailCompact: { width: 158, paddingVertical: 2 },
  playerRailPortrait: { flex: 1, width: undefined, minWidth: 0 },
  bottomDock: { minHeight: 130, maxHeight: 150, flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "rgba(3,18,14,0.97)" },
  bottomDockCompact: { minHeight: 118, maxHeight: 126 },
  bottomDockPortrait: { minHeight: 230, maxHeight: 265, flexDirection: "column" },
  viewerZone: { width: 340, paddingHorizontal: spacing.sm, paddingVertical: 3, alignItems: "stretch", gap: 0, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  viewerZonePortrait: { width: "100%", minHeight: 112, borderRightWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  handArea: { flex: 1, minWidth: 0, paddingVertical: spacing.xs },
  handHead: { minHeight: 22, paddingHorizontal: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  sectionLabel: { color: colors.paperMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  hand: { minWidth: "100%", alignItems: "flex-end", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 3 },
  utilities: { alignItems: "center", gap: spacing.sm },
  utility: { minHeight: 28, lineHeight: 26, color: colors.gold, fontSize: 9, fontWeight: "900", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold, overflow: "hidden" },
  empty: { color: colors.muted, fontSize: 11, fontStyle: "italic", padding: spacing.lg },
  errorToast: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 158, alignItems: "center", zIndex: 2000 },
  errorText: { color: colors.white, backgroundColor: colors.vermilionDark, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, fontSize: 12, fontWeight: "800" }
});
