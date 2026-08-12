import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider } from "../state/AppContext";
import { GameProvider } from "../state/GameContext";
import { colors } from "../theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <GameProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvasDeep },
              animation: "fade"
            }}
          />
        </GameProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
