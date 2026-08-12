import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { UiSeat } from "../game/uiTypes";
import { colors, radius, spacing } from "../theme/tokens";

export function PlayerBadge({ seat, compact = false }: { seat: UiSeat; compact?: boolean }) {
  return (
    <View
      accessibilityLabel={`${seat.name}, ${seat.chips} chips, ${seat.score} points${seat.isCurrent ? ", current turn" : ""}${seat.isDealer ? ", dealer" : ""}`}
      style={[styles.badge, compact && styles.compact, seat.isCurrent && styles.current]}
    >
      <View style={[styles.avatar, seat.isCurrent && styles.currentAvatar, seat.connected === false && styles.disconnected]}>
        <Text style={styles.avatarText}>{seat.isAi ? "AI" : seat.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>{seat.name}</Text>
          {seat.isDealer ? <Text style={styles.dealer}>선</Text> : null}
          {seat.goCount ? <Text style={styles.go}>GO ×{seat.goCount}</Text> : null}
        </View>
        <View style={styles.stats}>
          <Text style={styles.chips}>● {seat.chips}</Text>
          <Text style={styles.score}>{seat.score}점</Text>
          <Text style={styles.cards}>{seat.handCount}장</Text>
        </View>
      </View>
      {seat.isCurrent ? <View style={styles.turnDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 190, minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(4,22,17,0.74)" },
  compact: { minWidth: 155, minHeight: 54 },
  current: { borderColor: colors.gold, backgroundColor: "rgba(50,42,16,0.88)" },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.feltLight, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  currentAvatar: { backgroundColor: colors.vermilion, borderColor: colors.gold },
  disconnected: { opacity: 0.45 },
  avatarText: { color: colors.cream, fontSize: 12, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { color: colors.cream, maxWidth: 105, fontSize: 13, fontWeight: "900" },
  dealer: { color: colors.ink, backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, fontSize: 8, fontWeight: "900" },
  go: { color: colors.white, backgroundColor: colors.vermilion, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, fontSize: 8, fontWeight: "900" },
  stats: { flexDirection: "row", gap: spacing.sm, marginTop: 3 },
  chips: { color: colors.gold, fontSize: 11, fontWeight: "900" },
  score: { color: colors.paperMuted, fontSize: 11, fontWeight: "800" },
  cards: { color: colors.muted, fontSize: 10 },
  turnDot: { position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.canvasDeep }
});
