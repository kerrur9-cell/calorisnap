import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, passwordMatches, sameOrigin, validAdminToken } from "@/lib/push/admin-auth";
const attempts = new Map<string, { count: number; until: number }>();
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: validAdminToken(request.cookies.get(ADMIN_COOKIE)?.value || "") }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый запрос" }, { status: 403 });
  const ip = request.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  const entry = attempts.get(ip) || { count: 0, until: now + 600000 };
  if (entry.count >= 5) return NextResponse.json({ error: "Слишком много попыток. Подождите 10 минут." }, { status: 429 });
  entry.count++; attempts.set(ip, entry);
  const data = await request.json().catch(() => null);
  if (typeof data?.password !== "string" || data.password.length > 128 || !passwordMatches(data.password)) return NextResponse.json({ error: "Неверный пароль или панель не настроена" }, { status: 401 });
  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 3600 });
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Недопустимый запрос" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { path: "/api/admin", maxAge: 0 });
  return response;
}
