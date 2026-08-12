import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Language, MessageKey } from "../i18n/messages";
import { messages } from "../i18n/messages";

export interface AppSettings {
  language: Language;
  reducedMotion: boolean;
  highContrast: boolean;
  haptics: boolean;
  sound: boolean;
  cardZoom: boolean;
}

const defaults: AppSettings = {
  language: "en",
  reducedMotion: false,
  highContrast: false,
  haptics: true,
  sound: true,
  cardZoom: true
};

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (next: Partial<AppSettings>) => void;
  t: (key: MessageKey) => string;
}

const AppContext = createContext<AppContextValue | null>(null);
const STORAGE_KEY = "gostop.settings.v1";

export function AppProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setSettings((current) => ({ ...current, ...JSON.parse(stored) }));
      })
      .catch(() => undefined);
  }, []);

  const updateSettings = useCallback((next: Partial<AppSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...next };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => undefined);
      return updated;
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      t: (key) => messages[settings.language][key]
    }),
    [settings, updateSettings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
