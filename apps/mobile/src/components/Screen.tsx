import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../theme/tokens";

interface ScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}

export function Screen({ children, contentStyle, scroll = true, ...props }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={[colors.canvas, colors.canvasDeep]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>{content}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg
  }
});
