import { NextRequest, NextResponse } from "next/server";
import { syncDramasFromSources } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    // Если передан секретный токен для cron или админа
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Разрешаем также вызовы от приложения
    }

    const result = await syncDramasFromSources(true);
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/dramas/sync error:", error);
    return NextResponse.json({ error: "Ошибка синхронизации каталога" }, { status: 500 });
  }
}
