import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { saveDramaProgress } from "@/lib/dramas/drama-service";

export const runtime = "nodejs";

const progressSchema = z.object({
  dramaId: z.string().min(1),
  episodeId: z.string().min(1),
  episodeNumber: z.number().int().positive(),
  progressSeconds: z.number().nonnegative().default(0),
  isCompleted: z.boolean().default(false),
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

    const body = progressSchema.parse(await request.json());
    const progress = await saveDramaProgress(
      user.id,
      body.dramaId,
      body.episodeId,
      body.episodeNumber,
      body.progressSeconds,
      body.isCompleted,
    );

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("POST /api/dramas/progress error:", error);
    return NextResponse.json({ error: "Не удалось сохранить прогресс" }, { status: 400 });
  }
}
