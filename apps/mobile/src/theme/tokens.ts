export const colors = {
  ink: "#101412",
  canvas: "#0B2D24",
  canvasDeep: "#061C17",
  felt: "#123D31",
  feltLight: "#1A5241",
  paper: "#F8F1DE",
  paperMuted: "#DDD1B5",
  cream: "#FFF9E9",
  gold: "#E7B851",
  goldDeep: "#9D6E17",
  vermilion: "#D94A3A",
  vermilionDark: "#8D2821",
  blue: "#4F81B8",
  cyan: "#77C8C0",
  white: "#FFFFFF",
  muted: "#A8BDB4",
  line: "rgba(255,255,255,0.13)",
  success: "#75C992",
  warning: "#F0C167",
  danger: "#F07466",
  overlay: "rgba(3, 17, 13, 0.92)"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 36 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 7
} as const;
