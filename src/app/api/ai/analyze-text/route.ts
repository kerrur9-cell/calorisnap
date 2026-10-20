import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { analyzeFoodPhotoWithOpenRouter } from "@/lib/ai/openrouter";
import { analyzeFoodPhotoWithGroq } from "@/lib/ai/groq";

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
    const useGroq = request.headers.get("x-analysis-attempt") === "groq";
    try {
      const input = { description: body.data.description, totalWeightGrams: body.data.total_weight_grams };
      const result = useGroq ? await analyzeFoodPhotoWithGroq(input) : await analyzeFoodPhotoWithOpenRouter(input);
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      const nextAttempt = !useGroq && process.env.GROQ_API_KEY ? "groq" : null;
      return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось разобрать описание еды", nextAttempt, retryable: Boolean(nextAttempt) }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
  }
}
