import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDramaById } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const drama = await getDramaById(id, user?.id);
    if (!drama) {
      return NextResponse.json({ error: "Сериал не найден" }, { status: 404 });
    }

    return NextResponse.json({ drama }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("GET /api/dramas/[id] error:", error);
    return NextResponse.json({ error: "Не удалось загрузить данные сериала" }, { status: 500 });
  }
}
