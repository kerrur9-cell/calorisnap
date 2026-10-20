import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDramas, syncDramasFromSources } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const isAiParam = searchParams.get("isAi");
    const isAi = isAiParam === "true" ? true : isAiParam === "false" ? false : undefined;
    const favoriteOnly = searchParams.get("favoriteOnly") === "true";

    // Автоматическая фоновая ленивая синхронизация при первом открытии
    syncDramasFromSources(false).catch((err) => {
      console.warn("Background drama sync notice:", err);
    });

    const dramas = await getDramas({
      query,
      tag,
      isAi,
      favoriteOnly,
      userId: user?.id,
    });

    return NextResponse.json({ dramas }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("GET /api/dramas error:", error);
    return NextResponse.json({ error: "Не удалось загрузить сериалы" }, { status: 500 });
  }
}
