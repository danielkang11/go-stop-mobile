import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { AppHeader } from "../../components/AppHeader";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { createOnlineRoom } from "../../controllers/RemoteGameController";
import { useApp } from "../../state/AppContext";
import { colors, radius, spacing } from "../../theme/tokens";

const RELAY_URL = process.env.EXPO_PUBLIC_RELAY_URL?.replace(/\/$/, "") ?? "";

export default function OnlineEntryScreen() {
  const router = useRouter();
  const { t } = useApp();
  const [name, setName] = useState("Guest");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const enter = (roomCode: string) => {
    router.push({ pathname: "/room/[code]", params: { code: roomCode.toUpperCase(), name: name.trim() || "Guest" } });
  };

  const create = async () => {
    if (!RELAY_URL) return setError(t("notConfigured"));
    setLoading(true);
    setError(undefined);
    try {
      enter(await createOnlineRoom(RELAY_URL));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create room");
    } finally {
      setLoading(false);
    }
  };

  const join = () => {
    if (!RELAY_URL) return setError(t("notConfigured"));
    const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length < 6) return setError("Enter the complete room code.");
    enter(clean);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title={t("online")} eyebrow="INVITE ONLY · 초대 전용" />
      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>⌁</Text>
        <View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Ephemeral guest rooms</Text><Text style={styles.noticeBody}>No account or permanent balance. Active game state is retained only for short reconnection windows.</Text></View>
      </View>
      <View style={styles.panel}>
        <FormField label={t("playerName")} value={name} onChangeText={setName} maxLength={16} />
        <AppButton label={t("create")} caption="Start a new private room and share its code" onPress={create} loading={loading} />
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
        <FormField label={t("roomCode")} value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" maxLength={8} placeholder="ABCD2345" />
        <AppButton variant="secondary" label={t("join")} onPress={join} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      <Text style={styles.small}>Remote play needs EXPO_PUBLIC_RELAY_URL. If the service is unavailable, local and AI play remain fully functional.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 720 },
  notice: { flexDirection: "row", gap: spacing.lg, borderWidth: 1, borderColor: "rgba(119,200,192,0.4)", borderRadius: radius.md, backgroundColor: "rgba(119,200,192,0.08)", padding: spacing.lg, marginBottom: spacing.lg },
  noticeIcon: { color: colors.cyan, fontSize: 28 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.cream, fontSize: 15, fontWeight: "900" },
  noticeBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  panel: { gap: spacing.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  or: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  error: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: spacing.lg }
});
