import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { HwatuCard } from "../components/HwatuCard";
import { Screen } from "../components/Screen";
import type { UiCard } from "../game/uiTypes";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme/tokens";

const samples: UiCard[] = [
  { id: "m01-bright", month: 1, category: "bright", categoryKo: "광", name: "Pine bright", nameKo: "송학 광" },
  { id: "m07-boar", month: 7, category: "animal", categoryKo: "열끗", name: "Boar animal", nameKo: "멧돼지 열끗", isBoar: true },
  { id: "m09-blue-ribbon", month: 9, category: "ribbon", categoryKo: "띠", name: "Blue ribbon", nameKo: "청단" },
  { id: "bonus-2pi-a", month: null, category: "pi", categoryKo: "피", name: "Double-pi bonus", nameKo: "쌍피 보너스", bonus: true, piValue: 2 }
];

const sections = [
  {
    title: "How a turn works · 진행 방법",
    body: "Play one card from your hand, then flip one from the stock. Cards capture by matching month. With two possible table matches, you choose. Reach at least 3 points to choose Go or Stop."
  },
  {
    title: "Base scoring · 기본 점수",
    body: "광: 3 without rain = 3, 3 with rain = 2, 4 = 4, all 5 = 15. 열끗: 5 animals = 1, then +1 each; 고도리 adds 5. 띠: 5 ribbons = 1, then +1 each; 홍단·청단·초단 each add 3. 피: 10 = 1, then +1 each."
  },
  {
    title: "Go · 고",
    body: "After saying Go, your base score must rise before you can choose again. Go counts add multipliers: one Go adds 1 point, two Gos add 2; three or more multiply the score. A later opponent may still Stop first."
  },
  {
    title: "Special captures · 특수 규칙",
    body: "V2 includes 쪽, 따닥, 쓸, 뻑·자뻑, 폭탄, and 흔들기. These may take pi from opponents or add winner-side multipliers. Final-draw bonuses follow the frozen mvp-2 rules."
  },
  {
    title: "Double-pi bonus cards · 쌍피 보너스",
    body: "Two service cards are shuffled into the deck. Each counts as 2 pi and has no month, so it never matches a table card. Play or flip one to move it straight into your captured pi and reveal a replacement from the stock. A bonus dealt face-up to the table goes to the dealer and is replaced. Like other double-pi cards, it can be surrendered when no ordinary pi is available."
  },
  {
    title: "Bak penalties · 박",
    body: "피박 doubles a payer with 1–5 effective pi when the winner scores pi; zero pi is exempt in mvp-2. 광박 doubles a payer with no bright when the winner scores bright. 고박 can reassign both losing slots to an earlier Go caller."
  },
  {
    title: "Boar Pot house rule · 멧돼지 팟",
    body: "Each funded player antes 1 chip. The first player to capture the July boar immediately wins the entire central pot, even if someone else wins the round. An unclaimed pot carries forward."
  },
  {
    title: "Limited liability · 칩 부족",
    body: "A loser pays only the chips remaining in their wallet; balances never go negative. If anyone cannot ante the next round, the three-player session ends. Rebuys are deferred."
  }
] as const;

export default function RulesScreen() {
  const { t } = useApp();
  const [open, setOpen] = useState(0);
  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title={t("rules")} eyebrow="MVP-2 · 3인용" />
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Match months. Build sets. Know when to stop.</Text>
        <Text style={styles.introBody}>This app freezes one deterministic three-player rules profile. Household and regional Go-Stop variants may differ.</Text>
      </View>
      <View accessibilityLabel="Example Hwatu card categories" style={styles.cards}>{samples.map((card) => <HwatuCard key={card.id} card={card} compact />)}</View>
      <View style={styles.legend}><Legend color={colors.gold} label="광 · Bright" /><Legend color={colors.vermilion} label="열끗 · Animal" /><Legend color={colors.blue} label="띠 · Ribbon" /><Legend color={colors.ink} label="피 · Junk" /></View>
      <View style={styles.accordion}>
        {sections.map((section, index) => (
          <Pressable key={section.title} accessibilityRole="button" accessibilityState={{ expanded: open === index }} onPress={() => setOpen(open === index ? -1 : index)} style={styles.section}>
            <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.chevron}>{open === index ? "−" : "+"}</Text></View>
            {open === index ? <Text style={styles.sectionBody}>{section.body}</Text> : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.disclosure}><Text style={styles.disclosureTitle}>House-rule disclosure</Text><Text style={styles.disclosureBody}>The central ante and Catching the Boar pot are a documented optional Go-Stop variant, made mandatory for this product. Chips are session-only, cannot be purchased, transferred, or redeemed, and have no cash value.</Text></View>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 820 },
  intro: { alignItems: "center", marginBottom: spacing.lg },
  introTitle: { color: colors.cream, fontSize: 22, fontWeight: "900", textAlign: "center" },
  introBody: { color: colors.muted, maxWidth: 620, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: spacing.sm },
  cards: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginVertical: spacing.lg },
  legend: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: spacing.lg, marginBottom: spacing.xl },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.paperMuted, fontSize: 11, fontWeight: "700" },
  accordion: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" },
  section: { padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: "rgba(255,255,255,0.035)" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sectionTitle: { flex: 1, color: colors.cream, fontSize: 15, fontWeight: "900" },
  chevron: { color: colors.gold, fontSize: 24, fontWeight: "600" },
  sectionBody: { color: colors.paperMuted, fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  disclosure: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: "rgba(231,184,81,0.08)", borderWidth: 1, borderColor: "rgba(231,184,81,0.3)" },
  disclosureTitle: { color: colors.gold, fontWeight: "900", fontSize: 13 },
  disclosureBody: { color: colors.paperMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }
});
