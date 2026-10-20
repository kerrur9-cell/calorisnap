import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDramas } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const isAiParam = searchParams.get("isAi");
    const isAi = isAiParam === "true" ? true : isAiParam === "false" ? false : undefined;
    const favoriteOnly = searchParams.get("favoriteOnly") === "true";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    let userId: string | undefined;
    if (favoriteOnly) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;
      } catch {
        // Игнорируем ошибку сессии при публичном запросе
      }
    }

    let dramas = await getDramas({
      query,
      tag,
      isAi,
      favoriteOnly,
      userId,
    });

    if (offset > 0 || (limit && limit > 0)) {
      dramas = dramas.slice(offset, limit ? offset + limit : undefined);
    }

    return NextResponse.json(
      { dramas },
      {
        headers: {
          "Cache-Control": favoriteOnly
            ? "private, no-cache"
            : "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/dramas error:", error);
    return NextResponse.json({ error: "Не удалось загрузить сериалы" }, { status: 500 });
  }
}
