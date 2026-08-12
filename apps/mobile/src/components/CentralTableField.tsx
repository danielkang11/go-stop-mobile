import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";

import { createTableLayout, eventTargetForCard, type CardPlacement, type FieldSize, type TableLayout } from "../game/tableLayout";
import type { UiCard, UiGameView, UiMotionEvent, UiSeatId } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";
import { HwatuCard } from "./HwatuCard";

interface CentralTableFieldProps {
  view: UiGameView;
}

export function CentralTableField({ view }: CentralTableFieldProps) {
  const { t, settings } = useApp();
  const [field, setField] = useState<FieldSize>({ width: 0, height: 0 });
  const [movingCardIds, setMovingCardIds] = useState<ReadonlySet<string>>(new Set());
  const layout = useMemo(() => createTableLayout(view.table, field), [field, view.table]);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setField((current) => current.width === width && current.height === height ? current : { width, height });
  };
  const onMovingCardsChange = useCallback((ids: readonly string[]) => setMovingCardIds(new Set(ids)), []);

  return (
    <View style={styles.stage}>
      <View style={styles.header}>
        <Text style={styles.label}>{t("table")} · 바닥패</Text>
        <Text style={styles.hint}>{view.table.length} live · 공개패</Text>
      </View>
      <View accessibilityLabel={`${view.table.length} cards on the table, ${view.stockCount} cards in stock`} onLayout={onLayout} style={styles.field}>
        <View pointerEvents="none" style={styles.centerGuide} />
        {layout.cards.map((placement) => (
          <View
            key={placement.card.id}
            style={[
              styles.tableCard,
              {
                left: placement.x,
                top: placement.y,
                zIndex: placement.zIndex,
                opacity: movingCardIds.has(placement.card.id) ? 0 : 1,
                transform: [{ rotate: `${placement.rotation}deg` }]
              }
            ]}
          >
            <HwatuCard card={placement.card} compact />
          </View>
        ))}
        {view.table.length === 0 ? <Text style={styles.empty}>Table clear · 쓸!</Text> : null}
        <StockDeck layout={layout} count={view.stockCount} />
        <CardMotionLayer
          events={view.motionEvents}
          field={field}
          layout={layout}
          viewerSeatId={view.viewerSeatId}
          reducedMotion={settings.reducedMotion}
          onMovingCardsChange={onMovingCardsChange}
        />
      </View>
      {view.recentMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.event}>
          {settings.language === "ko" ? view.recentMessageKo : view.recentMessage}
        </Text>
      ) : null}
    </View>
  );
}

function StockDeck({ layout, count }: { layout: TableLayout; count: number }) {
  const placeholder: UiCard = { id: "stock-card", month: 1, category: "pi", categoryKo: "피", name: "Stock", nameKo: "더미" };
  return (
    <View
      accessibilityLabel={`${count} cards remaining in stock`}
      style={[styles.stock, { left: layout.stockX, top: layout.stockY }]}
    >
      {[0, 1, 2].map((offset) => (
        <View key={offset} style={[styles.stockLayer, { left: offset * 2, top: -offset * 2 }]}>
          <HwatuCard card={placeholder} compact hidden />
        </View>
      ))}
      <View style={styles.stockCountBadge}><Text style={styles.stockCount}>{count}</Text></View>
      <Text style={styles.stockCaption}>더미</Text>
    </View>
  );
}

interface MotionLayerProps {
  events: readonly UiMotionEvent[];
  field: FieldSize;
  layout: TableLayout;
  viewerSeatId: UiSeatId;
  reducedMotion: boolean;
  onMovingCardsChange: (ids: readonly string[]) => void;
}

function CardMotionLayer({ events, field, layout, viewerSeatId, reducedMotion, onMovingCardsChange }: MotionLayerProps) {
  const seen = useRef(new Set<string>());
  const progress = useRef(new Animated.Value(0)).current;
  const [queue, setQueue] = useState<UiMotionEvent[]>([]);
  const [active, setActive] = useState<UiMotionEvent>();

  useEffect(() => {
    const fresh = events.filter((event) => !seen.current.has(event.id));
    fresh.forEach((event) => seen.current.add(event.id));
    if (!reducedMotion && fresh.length > 0) setQueue((current) => [...current, ...fresh]);
  }, [events, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) return;
    progress.stopAnimation();
    setQueue([]);
    setActive(undefined);
  }, [progress, reducedMotion]);

  useEffect(() => {
    if (active || queue.length === 0 || field.width <= 0 || field.height <= 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: next?.kind === "stock-flip" ? 560 : 430,
      useNativeDriver: Platform.OS !== "web"
    }).start(() => setActive(undefined));
  }, [active, field.height, field.width, progress, queue]);

  useEffect(() => {
    onMovingCardsChange(active?.cards.map((card) => card.id) ?? []);
    return () => onMovingCardsChange([]);
  }, [active, onMovingCardsChange]);

  if (!active || reducedMotion) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {active.cards.map((card, index) => {
        const target = eventTargetForCard(card, layout, field);
        return (
          <MotionCard
            key={`${active.id}:${card.id}`}
            card={card}
            event={active}
            field={field}
            index={index}
            layout={layout}
            progress={progress}
            target={target}
            viewerSeatId={viewerSeatId}
          />
        );
      })}
    </View>
  );
}

function MotionCard({ card, event, field, index, layout, progress, target, viewerSeatId }: {
  card: UiCard;
  event: UiMotionEvent;
  field: FieldSize;
  index: number;
  layout: TableLayout;
  progress: Animated.Value;
  target: CardPlacement;
  viewerSeatId: UiSeatId;
}) {
  const origin = event.kind === "stock-flip"
    ? { x: layout.stockX, y: layout.stockY }
    : seatOrigin(event.actorSeatId, viewerSeatId, field, layout);
  const targetX = target.x + index * 4;
  const targetY = target.y + index * 3;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.x - targetX, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.y - targetY, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.82, 1.08, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0.4, 1, 1, 0.92] });
  const backOpacity = progress.interpolate({ inputRange: [0, 0.44, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const faceOpacity = progress.interpolate({ inputRange: [0, 0.46, 0.52, 1], outputRange: [0, 0, 1, 1] });
  const backRotation = progress.interpolate({ inputRange: [0, 0.52, 1], outputRange: ["0deg", "90deg", "180deg"] });
  const faceRotation = progress.interpolate({ inputRange: [0, 0.48, 1], outputRange: ["-90deg", "-90deg", "0deg"] });
  const stockFlip = event.kind === "stock-flip";
  return (
    <Animated.View style={[
      styles.motionCard,
      {
        left: targetX,
        top: targetY,
        opacity,
        transform: [translateXTransform(translateX), translateYTransform(translateY), { scale }, { rotate: `${target.rotation}deg` }]
      }
    ]}>
      {stockFlip ? (
        <>
          <Animated.View style={[styles.motionFace, { opacity: backOpacity, transform: [{ perspective: 700 }, { rotateY: backRotation }] }]}>
            <HwatuCard card={card} compact hidden />
          </Animated.View>
          <Animated.View style={[styles.motionFace, { opacity: faceOpacity, transform: [{ perspective: 700 }, { rotateY: faceRotation }] }]}>
            <HwatuCard card={card} compact />
          </Animated.View>
        </>
      ) : <HwatuCard card={card} compact />}
    </Animated.View>
  );
}

function translateXTransform(value: Animated.AnimatedInterpolation<string | number>) {
  return { translateX: value };
}

function translateYTransform(value: Animated.AnimatedInterpolation<string | number>) {
  return { translateY: value };
}

function seatOrigin(actor: UiSeatId, viewer: UiSeatId, field: FieldSize, layout: TableLayout) {
  const relative = (actor - viewer + 3) % 3;
  if (relative === 0) return { x: layout.stockX, y: field.height + 38 };
  if (relative === 1) return { x: -layout.cardWidth - 18, y: field.height * 0.24 };
  return { x: field.width + 18, y: field.height * 0.24 };
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minWidth: 230,
    minHeight: 190,
    margin: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.felt,
    overflow: "hidden"
  },
  header: {
    height: 31,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(0,0,0,0.09)"
  },
  label: { color: colors.paperMuted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  hint: { color: colors.muted, fontSize: 8, fontWeight: "800" },
  field: { flex: 1, minHeight: 155, position: "relative", overflow: "hidden" },
  centerGuide: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.035)",
    left: "50%",
    top: "50%",
    marginLeft: -65,
    marginTop: -65
  },
  tableCard: { position: "absolute", width: 46, height: 70 },
  stock: { position: "absolute", width: 50, height: 78, zIndex: 70 },
  stockLayer: { position: "absolute" },
  stockCountBadge: {
    position: "absolute",
    right: -10,
    top: -10,
    minWidth: 25,
    height: 25,
    paddingHorizontal: 5,
    borderRadius: 13,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.canvasDeep,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5
  },
  stockCount: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  stockCaption: { position: "absolute", width: 46, bottom: -13, color: colors.paperMuted, fontSize: 7, fontWeight: "900", textAlign: "center" },
  empty: { position: "absolute", left: 0, right: 0, top: "25%", color: colors.muted, fontSize: 11, fontStyle: "italic", textAlign: "center" },
  event: {
    position: "absolute",
    alignSelf: "center",
    bottom: 5,
    zIndex: 1000,
    color: colors.gold,
    backgroundColor: "rgba(0,0,0,0.67)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "800"
  },
  motionCard: { position: "absolute", width: 46, height: 70, zIndex: 900 },
  motionFace: { position: "absolute", left: 0, top: 0, width: 46, height: 70, backfaceVisibility: "hidden" }
});
