import {createHmac, timingSafeEqual} from "node:crypto";

/** Session lifetime. Google ID tokens expire after ~1h, so the app issues its own. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PREFIX = "ers1";

interface SessionPayload {
  sub: string;
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function isSessionToken(token: string): boolean {
  return token.startsWith(`${PREFIX}.`);
}

export function createSessionToken(subject: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = {sub: subject, exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS};
  const data = `${PREFIX}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${data}.${sign(data, secret)}`;
}

/** Returns the Google subject of a valid, unexpired session token, otherwise undefined. */
export function verifySessionToken(token: string, secret: string, now = Date.now()): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return undefined;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(data, secret));
  const received = Buffer.from(parts[2] ?? "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return undefined;
    if (payload.exp * 1000 <= now) return undefined;
    return payload.sub;
  } catch {
    return undefined;
  }
}
