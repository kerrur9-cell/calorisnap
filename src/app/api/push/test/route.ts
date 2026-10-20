import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint, sendWebPush } from "@/lib/push/web-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const parsed = z.object({ endpoint: z.string().url().max(2048).refine(isAllowedPushEndpoint) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Не найдена push-подписка этого устройства" }, { status: 400 });

  const { data: subscription, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint)
    .maybeSingle();
  if (error || !subscription) return NextResponse.json({ error: "Сначала включите уведомления на этом устройстве" }, { status: 404 });

  try {
    const result = await sendWebPush(subscription.endpoint, subscription, {
      title: "CaloriSnap",
      body: "Связь есть! Здесь будут ваши добрые напоминания 🌿",
      url: "/profile",
    });
    if (result === "expired") {
      await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
      return NextResponse.json({ error: "Подписка устарела. Включите уведомления заново." }, { status: 410 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Test push failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Тест не отправился. Проверьте VAPID-настройки и повторите." }, { status: 503 });
  }
}
