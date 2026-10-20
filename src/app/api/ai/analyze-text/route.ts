import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { analyzeFoodPhotoWithConsensus, type AnalysisProvider } from "@/lib/ai/consensus";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    const body = z.object({
      description: z.string().trim().min(3).max(2000),
      total_weight_grams: z.number().finite().positive().max(5000).optional(),
    }).safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Опишите еду: от 3 до 2000 символов. Вес — до 5000 г." }, { status: 400 });

    const attemptHeader = request.headers.get("x-analysis-attempt") as AnalysisProvider | null;
    const forcedProvider: AnalysisProvider | undefined =
      attemptHeader && ["gemini", "openrouter", "groq"].includes(attemptHeader) ? attemptHeader : undefined;

    try {
      const input = {
        description: body.data.description,
        totalWeightGrams: body.data.total_weight_grams,
        forcedProvider,
      };
      const result = await analyzeFoodPhotoWithConsensus(input);
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Не удалось разобрать описание еды",
        retryable: false,
      }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
  }
}
