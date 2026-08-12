import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CARD_BACK_SOURCE, cardFaceSource } from "../game/cardAssets";
import type { UiCard } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, shadow, spacing } from "../theme/tokens";

const MONTH_NAMES = ["", "Pine", "Plum", "Cherry", "Wisteria", "Iris", "Peony", "Clover", "Pampas", "Chrysanthemum", "Maple", "Paulownia", "Willow"];
const MONTH_NAMES_KO = ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산", "국진", "단풍", "오동", "비"];

interface HwatuCardProps {
  card: UiCard;
  onPress?: (() => void) | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  compact?: boolean | undefined;
  mini?: boolean | undefined;
  hidden?: boolean | undefined;
}

export function HwatuCard({ card, onPress, selected, disabled, compact, mini, hidden }: HwatuCardProps) {
  const { settings } = useApp();
  const [preview, setPreview] = useState(false);
  const isBonus = card.bonus || card.month === null;
  const monthName = isBonus ? (settings.language === "ko" ? "보너스" : "Bonus") : settings.language === "ko" ? MONTH_NAMES_KO[card.month!] : MONTH_NAMES[card.month!];
  const category = settings.language === "ko" ? card.categoryKo : card.category;
  const doublePiText = card.piValue === 2 ? settings.language === "ko" ? ", 쌍피, 피 두 장" : ", double pi, counts as two pi" : "";
  const accessibilityLabel = hidden
    ? settings.language === "ko" ? "뒤집힌 화투패" : "Face-down Hwatu card"
    : isBonus
      ? `${monthName}, ${category}${doublePiText}`
      : `${card.month}월, ${monthName}, ${category}${doublePiText}${card.isBoar ? settings.language === "ko" ? ", 멧돼지 팟 대상" : ", central pot target" : ""}`;

  return (
    <>
      <Pressable
        accessibilityRole={onPress || settings.cardZoom && !hidden ? "button" : "image"}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={!onPress && settings.cardZoom && !hidden ? "Long press for a larger card preview" : undefined}
        disabled={disabled}
        onPress={onPress}
        onLongPress={settings.cardZoom && !hidden ? () => setPreview(true) : undefined}
        style={({ pressed }) => [styles.card, compact && styles.compact, mini && styles.mini, hidden && styles.hidden, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <CardArtwork card={card} hidden={hidden} />
      </Pressable>
      <Modal transparent visible={preview} animationType={settings.reducedMotion ? "none" : "fade"} onRequestClose={() => setPreview(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close card preview" onPress={() => setPreview(false)} style={styles.modalBackdrop}>
          <View style={styles.preview} pointerEvents="none">
            <View style={styles.previewCard}><CardArtwork card={card} /></View>
            <Text style={styles.previewTitle}>{isBonus ? monthName : `${card.month} · ${monthName}`}</Text>
            <Text style={styles.previewBody}>{category}{card.piValue === 2 ? settings.language === "ko" ? " · 쌍피 · 2 피" : " · Double pi · 2 pi" : ""}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function CardArtwork({ card, hidden }: { card: UiCard; hidden?: boolean | undefined }) {
  const source = hidden ? CARD_BACK_SOURCE : cardFaceSource(card.id);
  if (!source) return <View style={styles.fallback}><Text style={styles.fallbackText}>{card.month ?? "J"}</Text></View>;
  return (
    <View style={styles.artworkWrap}>
      <Image source={source} resizeMode="cover" style={styles.artwork} />
      {!hidden ? (
        <View style={[styles.monthBadge, card.month === null && styles.bonusBadge]}>
          <Text style={styles.monthText}>{card.month ?? "J"}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 67, aspectRatio: 0.66, borderRadius: radius.sm, backgroundColor: colors.paper, borderWidth: 2, borderColor: "#DE2A1C", overflow: "hidden", ...shadow },
  compact: { width: 46, borderRadius: 6, borderWidth: 1 },
  mini: { width: 31, borderRadius: 4, borderWidth: 1 },
  hidden: { backgroundColor: colors.vermilionDark, borderColor: "#F7E9BD" },
  selected: { borderColor: colors.gold, borderWidth: 3, transform: [{ translateY: -8 }] },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: -5 }, { scale: 0.98 }] },
  artworkWrap: { flex: 1, backgroundColor: "#F9F1DD" },
  artwork: { width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9F1DD" },
  fallbackText: { color: colors.vermilionDark, fontSize: 24, fontWeight: "900" },
  monthBadge: { position: "absolute", left: 3, top: 3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: "rgba(16,13,10,0.9)", borderWidth: 1, borderColor: "rgba(255,248,226,0.92)", alignItems: "center", justifyContent: "center" },
  bonusBadge: { backgroundColor: "rgba(174,22,18,0.94)" },
  monthText: { color: "#FFF8E2", fontSize: 11, fontWeight: "900" },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  preview: { alignItems: "center", gap: spacing.md },
  previewCard: { width: 180, aspectRatio: 0.66, borderRadius: radius.lg, overflow: "hidden", borderWidth: 4, borderColor: colors.gold, ...shadow },
  previewTitle: { color: colors.cream, fontSize: 24, fontWeight: "900" },
  previewBody: { color: colors.gold, fontSize: 16, fontWeight: "800" }
});
