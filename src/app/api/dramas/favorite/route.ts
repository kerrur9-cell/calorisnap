import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toggleFavorite } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

const favoriteSchema = z.object({
  dramaId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = favoriteSchema.parse(await request.json());
    const isFavorite = await toggleFavorite(user.id, body.dramaId);

    return NextResponse.json({ isFavorite });
  } catch (error) {
    console.error("POST /api/dramas/favorite error:", error);
    return NextResponse.json({ error: "Не удалось изменить избранное" }, { status: 400 });
  }
}
