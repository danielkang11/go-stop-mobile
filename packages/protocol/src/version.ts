export const PROTOCOL_VERSION = 1 as const;
export const RULES_VERSION = "mvp-2" as const;
export const MAX_FRAME_BYTES = 16 * 1024;

export const PING_MESSAGE = { v: PROTOCOL_VERSION, type: "ping" } as const;
export const PONG_MESSAGE = { v: PROTOCOL_VERSION, type: "pong" } as const;
export const PING_BYTES = JSON.stringify(PING_MESSAGE);
export const PONG_BYTES = JSON.stringify(PONG_MESSAGE);
