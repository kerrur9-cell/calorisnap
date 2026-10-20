import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint } from "@/lib/push/web-push";

export const runtime = "nodejs";

const timeSchema = z.string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  .refine((value) => Number(value.slice(3, 5)) % 15 === 0, "Выберите время с шагом 15 минут");
const timeZoneSchema = z.string().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Некорректный часовой пояс");
const endpointSchema = z.string().url().max(2048).refine(isAllowedPushEndpoint, "Неподдерживаемый push-сервис");

const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(20).max(128),
    auth: z.string().min(16).max(64),
  }),
  reminderTime: timeSchema,
  timezone: timeZoneSchema,
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint || !endpointSchema.safeParse(endpoint).success) {
    return NextResponse.json({ preference: null });
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("reminder_time,timezone,enabled")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Не удалось загрузить настройки уведомлений" }, { status: 503 });
  return NextResponse.json({ preference: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректная push-подписка" }, { status: 400 });

  const value = parsed.data;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: value.endpoint,
    p256dh: value.keys.p256dh,
    auth: value.keys.auth,
    reminder_time: value.reminderTime,
    timezone: value.timezone,
    enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) {
    console.error("Could not save push subscription", { code: error.code });
    return NextResponse.json({ error: "Не удалось сохранить настройки. Проверьте, применена ли миграция уведомлений." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const schema = z.object({ endpoint: endpointSchema, reminderTime: timeSchema, timezone: timeZoneSchema });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Укажите время и часовой пояс" }, { status: 400 });

  const { error, count } = await supabase.from("push_subscriptions").update({
    reminder_time: parsed.data.reminderTime,
    timezone: parsed.data.timezone,
    enabled: true,
    updated_at: new Date().toISOString(),
  }, { count: "exact" }).eq("user_id", user.id).eq("endpoint", parsed.data.endpoint);
  if (error || count === 0) return NextResponse.json({ error: "Не удалось сохранить время уведомления" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const parsed = z.object({ endpoint: endpointSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректная push-подписка" }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return NextResponse.json({ error: "Не удалось выключить уведомления" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
