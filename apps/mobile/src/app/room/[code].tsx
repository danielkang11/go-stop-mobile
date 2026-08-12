import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../components/AppButton";
import { AppHeader } from "../../components/AppHeader";
import { Screen } from "../../components/Screen";
import { RemoteGameController, type RemoteConnectionState } from "../../controllers/RemoteGameController";
import { useApp } from "../../state/AppContext";
import { useGame } from "../../state/GameContext";
import { colors, radius, spacing } from "../../theme/tokens";

const RELAY_URL = process.env.EXPO_PUBLIC_RELAY_URL?.replace(/\/$/, "") ?? "";

export default function RoomLobbyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; name?: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { attachController } = useGame();
  const [connection, setConnection] = useState<RemoteConnectionState>({ status: "connecting" });
  const controllerRef = useRef<RemoteGameController | undefined>(undefined);
  const handedOff = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new RemoteGameController({ relayUrl: RELAY_URL, roomCode: code, displayName: String(params.name ?? "Guest") });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(() => {
      const nextConnection = { ...controller.getConnectionState() };
      setConnection(nextConnection);
      const self = nextConnection.lobby?.seats.find((seat) => seat.seatId === nextConnection.lobby?.selfSeatId);
      if (self) setReady(self.ready);
      if (controller.isPlaying() && !handedOff.current) {
        handedOff.current = true;
        const sessionId = attachController(controller);
        router.replace({ pathname: "/game/[sessionId]", params: { sessionId } });
      }
    });
    controller.connect();
    return () => {
      unsubscribe();
      if (!handedOff.current) controller.dispose();
    };
  }, [attachController, code, params.name, router]);

  const toggleReady = async () => {
    const next = !ready;
    const result = await controllerRef.current?.setReady(next);
    if (result?.ok) setReady(next);
  };

  const lobby = connection.lobby;
  return (
    <Screen>
      <AppHeader title="Online lobby" eyebrow={connection.status.toUpperCase()} />
      <View style={styles.codePanel}>
        <Text style={styles.codeLabel}>{t("roomCode")}</Text>
        <Text accessibilityLabel={`Room code ${code.split("").join(" ")}`} selectable style={styles.code}>{code}</Text>
        <Pressable accessibilityRole="button" onPress={() => Clipboard.setStringAsync(code)} style={styles.copy}><Text style={styles.copyText}>⧉ {t("shareCode")}</Text></Pressable>
      </View>
      <View style={styles.seats}>
        {[0, 1, 2].map((id) => {
          const seat = lobby?.seats.find((item) => item.seatId === id);
          const self = lobby?.selfSeatId === id;
          return (
            <View key={id} style={[styles.seat, self && styles.selfSeat]}>
              <View style={[styles.avatar, seat?.connected && styles.avatarConnected]}><Text style={styles.avatarText}>{seat ? seat.displayName.slice(0, 1).toUpperCase() : "+"}</Text></View>
              <Text style={styles.seatName}>{seat?.displayName ?? "Open seat"}{self ? " · You" : ""}</Text>
              <Text style={[styles.seatStatus, seat?.ready && styles.ready]}>{seat ? seat.ready ? "READY · 준비" : "NOT READY" : "Waiting…"}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.footer}>
        {connection.status === "connecting" || connection.status === "reconnecting" ? <View style={styles.status}><ActivityIndicator color={colors.gold} /><Text style={styles.statusText}>{connection.status === "reconnecting" ? t("reconnecting") : "Joining room…"}</Text></View> : null}
        {connection.error ? <Text accessibilityRole="alert" style={styles.error}>{connection.error}</Text> : null}
        <AppButton label={ready ? "Cancel ready" : t("ready")} onPress={toggleReady} disabled={!lobby} />
        <Text style={styles.hint}>The match starts automatically when all three occupied seats are ready.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codePanel: { alignItems: "center", backgroundColor: "rgba(231,184,81,0.08)", borderWidth: 1, borderColor: "rgba(231,184,81,0.35)", borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl },
  codeLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" },
  code: { color: colors.gold, fontSize: 34, fontWeight: "900", letterSpacing: 5, marginVertical: spacing.sm },
  copy: { minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center" },
  copyText: { color: colors.cream, fontSize: 13, fontWeight: "800" },
  seats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  seat: { flex: 1, minWidth: 180, alignItems: "center", padding: spacing.xl, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.035)" },
  selfSeat: { borderColor: colors.gold, backgroundColor: "rgba(231,184,81,0.07)" },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.felt, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarConnected: { borderColor: colors.success },
  avatarText: { color: colors.cream, fontSize: 23, fontWeight: "900" },
  seatName: { color: colors.cream, fontSize: 15, fontWeight: "900", textAlign: "center" },
  seatStatus: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 6 },
  ready: { color: colors.success },
  footer: { marginTop: spacing.xl, maxWidth: 560, width: "100%", alignSelf: "center", gap: spacing.md },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  statusText: { color: colors.paperMuted, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center", fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 11, textAlign: "center" }
});
