import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { UiSeat } from "../game/uiTypes";
import { groupCapturedCards, type CapturedGroup } from "../game/capturedGroups";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";
import { HwatuCard } from "./HwatuCard";

const GROUPS = [
  { category: "bright", en: "Gwang", ko: "광" },
  { category: "animal", en: "Animal", ko: "열끗" },
  { category: "ribbon", en: "Tti", ko: "띠" },
  { category: "pi", en: "Pi", ko: "피" }
] as const;

interface CapturedSpreadProps {
  seat: UiSeat;
  orientation?: "rail" | "dock";
}

export function CapturedSpread({ seat, orientation = "rail" }: CapturedSpreadProps) {
  const { settings } = useApp();
  const groups = groupCapturedCards(seat.captured);
  const summary = groups.map((group, index) => `${settings.language === "ko" ? GROUPS[index]!.ko : GROUPS[index]!.en} ${group.effectiveCount}`).join(", ");

  return (
    <View
      accessibilityLabel={`${seat.name} captured cards: ${summary}`}
      style={[styles.spread, orientation === "dock" && styles.spreadDock]}
    >
      {groups.map((group, index) => (
        <CaptureGroup
          key={group.category}
          group={group}
          label={settings.language === "ko" ? GROUPS[index]!.ko : GROUPS[index]!.en}
          dock={orientation === "dock"}
        />
      ))}
    </View>
  );
}

function CaptureGroup({ group, label, dock }: { group: CapturedGroup; label: string; dock: boolean }) {
  const cardCount = group.cards.length;
  const availableWidth = dock ? 70 : 74;
  const cardWidth = 31;
  const cardHeight = 47;
  const overlap = cardCount <= 1 ? 0 : Math.max(4, Math.min(12, (availableWidth - cardWidth) / (cardCount - 1)));
  const visualWidth = cardCount === 0 ? 28 : Math.min(availableWidth, cardWidth + overlap * (cardCount - 1));
  return (
    <View style={[styles.group, dock && styles.groupDock]}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupLabel}>{label}</Text>
        <Text style={styles.groupCount}>{group.effectiveCount}</Text>
      </View>
      <View style={[styles.cardFan, { width: visualWidth }]}>
        {group.cards.length === 0 ? <View style={styles.emptySlot} /> : group.cards.map((card, cardIndex) => (
          <View
            key={card.id}
            style={[
              styles.miniCard,
              {
                left: cardIndex * overlap,
                zIndex: cardIndex + 1,
                transform: [
                  { rotate: `${(cardIndex % 3 - 1) * 2.2}deg` }
                ]
              }
            ]}
          >
            <HwatuCard card={card} mini />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spread: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 3
  },
  spreadDock: { flexWrap: "nowrap", justifyContent: "flex-start", gap: spacing.xs },
  group: {
    width: "48%",
    minWidth: 70,
    height: 61,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: "rgba(0,0,0,0.14)",
    overflow: "hidden"
  },
  groupDock: { width: 78, minWidth: 68 },
  groupHeader: { height: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  groupCount: { color: colors.gold, fontSize: 9, fontWeight: "900" },
  cardFan: { position: "relative", height: 42, alignSelf: "center" },
  miniCard: { position: "absolute", width: 31, height: 47, top: 0 },
  emptySlot: { width: 25, height: 35, alignSelf: "center", borderRadius: 4, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line }
});
