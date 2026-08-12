import { createRoomCode, normalizeRoomCode } from "./auth";
import { GameRoom } from "./GameRoom";
import type { Env } from "./types";

const CREATE_LIMIT = 10;
const CONNECT_LIMIT = 120;
const WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, protocolVersion: 1, rulesVersion: "mvp-2" });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/rooms") {
      const key = rateLimitKey(request, "create");
      if (!takeRateLimit(key, CREATE_LIMIT, Date.now())) {
        return jsonResponse({ code: "RATE_LIMITED" }, 429);
      }
      return createRoom(env);
    }

    const match = /^\/v1\/rooms\/([^/]+)\/ws$/u.exec(url.pathname);
    if (request.method === "GET" && match !== null) {
      const roomCode = normalizeRoomCode(decodeURIComponent(match[1]!));
      if (roomCode === null) {
        return jsonResponse({ code: "ROOM_NOT_FOUND" }, 404);
      }
      const key = rateLimitKey(request, "connect");
      if (!takeRateLimit(key, CONNECT_LIMIT, Date.now())) {
        return jsonResponse({ code: "RATE_LIMITED" }, 429);
      }
      const id = env.GAME_ROOMS.idFromName(roomCode);
      return env.GAME_ROOMS.get(id).fetch(request);
    }

    return jsonResponse({ code: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function createRoom(env: Env): Promise<Response> {
  const now = Date.now();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = createRoomCode();
    const id = env.GAME_ROOMS.idFromName(roomCode);
    const response = await env.GAME_ROOMS.get(id).fetch(
      new Request("https://room.internal/internal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, now }),
      }),
    );
    if (response.status === 409) {
      continue;
    }
    if (!response.ok) {
      return jsonResponse({ code: "INTERNAL_ERROR" }, 503);
    }
    const payload = (await response.json()) as { expiresAt: number };
    return jsonResponse(
      {
        roomCode,
        websocketPath: `/v1/rooms/${roomCode}/ws`,
        expiresAt: payload.expiresAt,
      },
      201,
    );
  }
  return jsonResponse({ code: "INTERNAL_ERROR" }, 503);
}

function rateLimitKey(request: Request, action: string): string {
  const installation = request.headers.get("X-Installation-Id")?.slice(0, 128);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return `${action}:${installation ?? ip}`;
}

export function takeRateLimit(key: string, limit: number, now: number): boolean {
  const previous = attempts.get(key);
  if (previous === undefined || previous.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (previous.count >= limit) {
    return false;
  }
  previous.count += 1;
  return true;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Installation-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
    },
  });
}
