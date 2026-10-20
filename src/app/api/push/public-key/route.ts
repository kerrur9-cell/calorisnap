import { NextResponse } from "next/server";
import { deriveVapidPublicKey } from "@/lib/push/web-push";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: "Push-уведомления ещё не настроены на сервере" }, { status: 503 });
    }
    return NextResponse.json(
      { publicKey: deriveVapidPublicKey(process.env.VAPID_PRIVATE_KEY) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Не удалось подготовить push-уведомления" }, { status: 503 });
  }
}
