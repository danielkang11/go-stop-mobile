import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "../theme/tokens";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mark, compact && styles.compact]}>
      <View style={styles.sun} />
      <View style={[styles.ribbon, styles.ribbonOne]} />
      <View style={[styles.ribbon, styles.ribbonTwo]} />
      <Text style={[styles.glyph, compact && styles.compactGlyph]}>고</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 92,
    height: 116,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.gold,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }]
  },
  compact: { width: 52, height: 66, borderRadius: radius.md, borderWidth: 2 },
  sun: { position: "absolute", width: 54, height: 54, borderRadius: 27, backgroundColor: colors.vermilion, top: 15, right: -12 },
  ribbon: { position: "absolute", width: 110, height: 12, backgroundColor: colors.ink, transform: [{ rotate: "42deg" }] },
  ribbonOne: { left: -34, bottom: 18 },
  ribbonTwo: { left: -40, bottom: 35, backgroundColor: colors.vermilionDark },
  glyph: { color: colors.ink, fontSize: 45, fontWeight: "900", textShadowColor: colors.paper, textShadowRadius: 3 },
  compactGlyph: { fontSize: 27 }
});
