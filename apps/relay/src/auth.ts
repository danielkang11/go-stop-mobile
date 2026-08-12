import type { PendingResumeToken, StoredSeat } from "./types";

const ROOM_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ROOM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/u;

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function createResumeToken(): string {
  return encodeBase64Url(randomBytes(32));
}

export function createConnectionEpoch(): string {
  return encodeBase64Url(randomBytes(16));
}

export function createConnectionId(): string {
  return encodeBase64Url(randomBytes(12));
}

export function createRoomCode(bytes = randomBytes(8)): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += ROOM_CODE_ALPHABET[bytes[index]! & 31];
  }
  return code;
}

export function normalizeRoomCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeDisplayName(value: string): string | null {
  const withoutControls = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (withoutControls.length === 0) {
    return null;
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = [...segmenter.segment(withoutControls)].map(
    (segment) => segment.segment,
  );
  if (graphemes.length > 16) {
    return graphemes.slice(0, 16).join("");
  }
  return withoutControls;
}

export async function hashResumeToken(token: string): Promise<string> {
  const input = new TextEncoder().encode(token);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function tokenHashesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Consumes an allowed credential for a resume. The acknowledged token has one
 * recovery use while a pending rotation overlaps; a pending token itself can
 * be used once and is then promoted before the next rotation begins.
 */
export function acceptResumeCredential(
  seat: StoredSeat,
  suppliedHash: string,
): "current" | "pending" | null {
  const pendingMatches =
    seat.pendingToken !== undefined &&
    tokenHashesEqual(seat.pendingToken.hash, suppliedHash);
  const currentMatches = tokenHashesEqual(seat.currentTokenHash, suppliedHash);
  if (!pendingMatches && !currentMatches) {
    return null;
  }
  if (currentMatches && seat.pendingToken !== undefined && seat.overlapRecoveryUsed) {
    return null;
  }
  if (pendingMatches && seat.pendingToken !== undefined) {
    seat.currentTokenHash = seat.pendingToken.hash;
    seat.overlapRecoveryUsed = true;
    return "pending";
  }
  if (seat.pendingToken !== undefined) {
    seat.overlapRecoveryUsed = true;
  } else {
    seat.overlapRecoveryUsed = false;
  }
  return "current";
}

export function beginTokenRotation(
  seat: StoredSeat,
  pendingToken: PendingResumeToken,
): void {
  seat.pendingToken = pendingToken;
  seat.connectionEpoch = pendingToken.connectionEpoch;
}

export function acknowledgeTokenRotation(
  seat: StoredSeat,
  connectionEpoch: string,
): boolean {
  if (seat.pendingToken?.connectionEpoch !== connectionEpoch) {
    return false;
  }
  seat.currentTokenHash = seat.pendingToken.hash;
  delete seat.pendingToken;
  seat.overlapRecoveryUsed = false;
  return true;
}
