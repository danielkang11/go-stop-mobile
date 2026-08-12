import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Go Stop Together",
  slug: "go-stop-together",
  scheme: "gostop",
  version: "0.2.0",
  orientation: "default",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.gostoptogether.mobile",
    infoPlist: {
      UISupportedInterfaceOrientations: [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight"
      ]
    }
  },
  android: {
    package: "com.gostoptogether.mobile"
  },
  plugins: ["expo-router", "expo-secure-store", "expo-status-bar"],
  experiments: { typedRoutes: true },
  extra: {
    relayUrl: process.env.EXPO_PUBLIC_RELAY_URL ?? ""
  }
};

export default config;
