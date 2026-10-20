import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_COOKIE, sameOrigin, validAdminToken } from "@/lib/push/admin-auth";
import { makeLovingMessage } from "@/lib/push/message";
import { sendWebPush } from "@/lib/push/web-push";
export const runtime = "nodejs";
const actions = {
  hug: { title: "Лови обнимашку 💚", url: "/day", label: "Открыть дневник" },
  log: { title: "Маленькая забота о тебе 🌸", url: "/foods", label: "Записать еду" },
  photo: { title: "Дашуля, покажешь вкусняшку? 🍓", url: "/camera", label: "Открыть камеру" },
  idea: { title: "Пауза для Дашули ✨", url: "/hub", label: "Открыть инструменты" },
} as const;
const schema = z.object({ operation: z.enum(["generate", "send"]), code: z.literal("CAL-SZT7-KK3Z"), kind: z.enum(["hug", "log", "photo", "idea"]), message: z.string().trim().min(1).max(180).optional() });
let lastSend = 0;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || !validAdminToken(request.cookies.get(ADMIN_COOKIE)?.value || "")) return NextResponse.json({ error: "Войдите в админ-панель" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Проверьте код получателя и сообщение (до 180 символов)" }, { status: 400 });
  const input = parsed.data;
  if (input.operation === "generate") {
    const result = await makeLovingMessage([], actions[input.kind].title);
    return NextResponse.json({ message: result.text, generated: result.generated });
  }
  if (!input.message) return NextResponse.json({ error: "Сначала напишите или создайте сообщение" }, { status: 400 });
  if (Date.now() - lastSend < 10000) return NextResponse.json({ error: "Подождите 10 секунд перед следующей отправкой" }, { status: 429 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Push ещё не настроен" }, { status: 503 });
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: friend, error: friendError } = await db.from("friend_access_codes").select("user_id").eq("code", input.code).eq("is_active", true).maybeSingle();
    if (friendError) throw new Error("lookup failed");
    if (!friend) return NextResponse.json({ error: "Активный код не найден. Возможно, пользователь обновил код." }, { status: 404 });
    const { data: subscriptions, error } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", friend.user_id).eq("enabled", true).limit(10);
    if (error) throw new Error("subscriptions failed");
    if (!subscriptions?.length) return NextResponse.json({ error: "У Даши пока нет включённых уведомлений. Ей нужно разрешить их на своём телефоне." }, { status: 409 });
    lastSend = Date.now();
    const action = actions[input.kind];
    const results = await Promise.allSettled(subscriptions.map(async row => {
      const result = await sendWebPush(row.endpoint, row, { title: action.title, body: input.message!, url: action.url, tag: `gift-${randomUUID()}`, actions: [{ action: "open", title: action.label, url: action.url }] });
      if (result === "expired") await db.from("push_subscriptions").delete().eq("id", row.id);
      return result;
    }));
    const accepted = results.filter(r => r.status === "fulfilled" && r.value !== "expired").length;
    if (!accepted) return NextResponse.json({ error: "Push-сервис не принял сообщение. Проверьте подписку на телефоне." }, { status: 503 });
    return NextResponse.json({ ok: true, accepted, failed: results.length - accepted });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить сообщение. Попробуйте снова." }, { status: 503 });
  }
}
