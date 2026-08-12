import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { AppHeader } from "../../components/AppHeader";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { useApp } from "../../state/AppContext";
import { useGame } from "../../state/GameContext";
import { colors, radius, spacing } from "../../theme/tokens";

export default function AiSetupScreen() {
  const router = useRouter();
  const { t } = useApp();
  const { startAi } = useGame();
  const [name, setName] = useState("You");
  const [difficulty, setDifficulty] = useState<"easy" | "standard">("standard");

  const start = () => {
    const sessionId = startAi(name.trim() || "You", difficulty);
    router.replace({ pathname: "/game/[sessionId]", params: { sessionId } });
  };

  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title={t("ai")} eyebrow="SOLO TABLE · AI 대국" />
      <View style={styles.panel}>
        <View style={styles.avatarRow}>
          <Avatar glyph="나" name={name || "You"} human />
          <Text style={styles.vs}>VS</Text>
          <Avatar glyph="한" name="Hana AI" />
          <Avatar glyph="둘" name="Duri AI" />
        </View>
        <FormField label={t("playerName")} value={name} onChangeText={setName} maxLength={16} />
        <View>
          <Text style={styles.label}>{t("difficulty")}</Text>
          <View style={styles.segment}>
            {(["easy", "standard"] as const).map((value) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: difficulty === value }} onPress={() => setDifficulty(value)} style={[styles.segmentItem, difficulty === value && styles.segmentSelected]}>
                <Text style={[styles.segmentText, difficulty === value && styles.segmentSelectedText]}>{t(value)}</Text>
                <Text style={styles.segmentCaption}>{value === "easy" ? "Random legal plays" : "Visible-state strategy"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.privacy}>AI players receive only their own projected hand and public table state. They never inspect your cards or the stock order.</Text>
        <AppButton label={t("start")} onPress={start} />
      </View>
    </Screen>
  );
}

function Avatar({ glyph, name, human }: { glyph: string; name: string; human?: boolean }) {
  return <View style={styles.avatarWrap}><View style={[styles.avatar, human && styles.avatarHuman]}><Text style={styles.avatarGlyph}>{glyph}</Text></View><Text numberOfLines={1} style={styles.avatarName}>{name}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 760 },
  panel: { gap: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.045)" },
  avatarRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  avatarWrap: { alignItems: "center", gap: 6, maxWidth: 100 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.feltLight, borderColor: colors.gold, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarHuman: { backgroundColor: colors.vermilion },
  avatarGlyph: { color: colors.cream, fontSize: 21, fontWeight: "900" },
  avatarName: { color: colors.paperMuted, fontSize: 12, fontWeight: "700" },
  vs: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  label: { color: colors.paperMuted, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  segment: { flexDirection: "row", gap: spacing.sm },
  segmentItem: { flex: 1, minHeight: 68, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.felt, justifyContent: "center" },
  segmentSelected: { borderColor: colors.gold, backgroundColor: "rgba(231,184,81,0.12)" },
  segmentText: { color: colors.paperMuted, fontSize: 16, fontWeight: "900" },
  segmentSelectedText: { color: colors.gold },
  segmentCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  privacy: { color: colors.muted, fontSize: 12, lineHeight: 18 }
});
