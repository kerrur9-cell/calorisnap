import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const ADMIN_COOKIE = "calorisnap_admin";
function secret() { return process.env.ADMIN_SESSION_SECRET; }
export function passwordMatches(value: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !secret()) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createAdminToken(now = Date.now()) {
  if (!secret()) throw new Error("Admin not configured");
  const body = `${now + 3600000}.${randomBytes(24).toString("hex")}`;
  return `${body}.${createHmac("sha256", secret()!).update(body).digest("hex")}`;
}
export function validAdminToken(token: string, now = Date.now()) {
  if (!secret()) return false;
  const [expires, nonce, signature, extra] = token.split(".");
  if (extra || !/^\d+$/.test(expires || "") || !/^[a-f0-9]{48}$/.test(nonce || "") || !/^[a-f0-9]{64}$/.test(signature || "") || Number(expires) <= now || Number(expires) > now + 3600000) return false;
  const expected = createHmac("sha256", secret()!).update(`${expires}.${nonce}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  // Netlify may rebuild request.url using its internal HTTP host.
  // Trust explicit deployment origins, never client-controlled forwarded headers.
  const allowed = ["https://calorisnap-ai.netlify.app", process.env.URL, process.env.DEPLOY_PRIME_URL];
  if (process.env.NODE_ENV !== "production") allowed.push(new URL(request.url).origin);
  return allowed.some(value => {
    if (!value) return false;
    try { return origin === new URL(value).origin; } catch { return false; }
  });
}
