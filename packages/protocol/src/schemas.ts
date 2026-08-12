import { z } from "zod";

import { REJECT_CODES } from "./errors";
import type { ClientMessage, ServerMessage } from "./messages";
import { MAX_FRAME_BYTES, PROTOCOL_VERSION, RULES_VERSION } from "./version";

const seatIdSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const roomCodeSchema = z
  .string()
  .length(8)
  .regex(/^[0-9A-HJKMNP-TV-Z]{8}$/u);
const boundedIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\w.:-]+$/u);

const helloSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal("hello"),
    clientBuild: z.string().min(1).max(64),
    roomCode: roomCodeSchema,
    supportedRulesVersions: z.array(z.literal(RULES_VERSION)).min(1).max(4),
    join: z
      .object({ displayName: z.string().min(1).max(128) })
      .strict()
      .optional(),
    resume: z
      .object({
        seatId: seatIdSchema,
        token: z.string().min(32).max(128),
        lastRevision: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.join === undefined) === (value.resume === undefined)) {
      context.addIssue({
        code: "custom",
        message: "hello requires exactly one of join or resume",
      });
    }
  });

const setReadyCommandSchema = z
  .object({
    type: z.literal("set-ready"),
    ready: z.boolean(),
  })
  .strict();

const gameCommandSchema = z
  .object({ type: z.string().min(1).max(64) })
  .loose()
  .refine((value) => value.type !== "set-ready", {
    message: "reserved relay command",
  });

const commandSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal("command"),
    commandId: boundedIdentifierSchema,
    expectedRevision: z.number().int().nonnegative(),
    payload: z.union([setReadyCommandSchema, gameCommandSchema]),
  })
  .strict();

const tokenAckSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal("token_ack"),
    connectionEpoch: boundedIdentifierSchema,
  })
  .strict();

const pingSchema = z
  .object({ v: z.literal(PROTOCOL_VERSION), type: z.literal("ping") })
  .strict();

export const clientMessageSchema = z.discriminatedUnion("type", [
  helloSchema,
  commandSchema,
  tokenAckSchema,
  pingSchema,
]);

export const rejectCodeSchema = z.enum(REJECT_CODES);

function byteLength(frame: string): number {
  return new TextEncoder().encode(frame).byteLength;
}

export type ParseClientMessageResult =
  | { readonly ok: true; readonly value: ClientMessage }
  | {
      readonly ok: false;
      readonly code: "BAD_MESSAGE" | "FRAME_TOO_LARGE";
      readonly reason: string;
    };

export function parseClientMessage(frame: string): ParseClientMessageResult {
  if (byteLength(frame) > MAX_FRAME_BYTES) {
    return {
      ok: false,
      code: "FRAME_TOO_LARGE",
      reason: `Frame exceeds ${MAX_FRAME_BYTES} bytes`,
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(frame);
  } catch {
    return { ok: false, code: "BAD_MESSAGE", reason: "Invalid JSON" };
  }

  const result = clientMessageSchema.safeParse(decoded);
  if (!result.success) {
    return {
      ok: false,
      code: "BAD_MESSAGE",
      reason: result.error.issues[0]?.message ?? "Invalid message",
    };
  }

  return { ok: true, value: result.data as ClientMessage };
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
