import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiJson } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  transcript: z.string().trim().min(2).max(500),
  defaultMealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  weight_grams: z.number().finite().positive().max(5000),
  calories: z.number().finite().nonnegative().max(10000),
  protein_g: z.number().finite().nonnegative().max(500),
  fat_g: z.number().finite().nonnegative().max(500),
  carbs_g: z.number().finite().nonnegative().max(500),
});

const voiceResponseSchema = z.object({
  suggestedMealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  items: z.array(itemSchema).default([]),
});

const SYSTEM_PROMPT = `Ты — профессиональный пищевой парсер CaloriSnap.
Твоя задача — преобразовать голосовую фразу пользователя на русском языке в структурированный список продуктов с реалистичными граммовками и КБЖУ.
Стандартные ориентиры порций в России:
- 1 яйцо = 55 г (75 ккал, Б 6.5, Ж 5.5, У 0.5)
- 1 кусок хлеба = 30-35 г (80 ккал, Б 2.5, Ж 0.8, У 15)
- 1 чашка кофе с молоком / капучино / латте = 200-250 г (90-135 ккал, Б 5-7, Ж 4-6, У 9-13)
- 1 тарелка каши / супа = 200-250 г
- 1 яблоко / банан = 120-150 г
- 1 порция мяса / филе = 120-180 г
Верни ТОЛЬКО валидный JSON:
{
  "suggestedMealType": "breakfast" | "lunch" | "dinner" | "snack",
  "items": [
    {
      "name": "Название",
      "weight_grams": 100,
      "calories": 150,
      "protein_g": 5,
      "fat_g": 5,
      "carbs_g": 20
    }
  ]
}`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY);
  const userPrompt = `Пользователь сказал: "${body.transcript}". Предпочтительный приём пищи: ${body.defaultMealType ?? "auto"}. Распознай продукты и граммовки.`;

  if (hasGemini) {
    try {
      const parsed = await generateGeminiJson({
        systemPrompt: SYSTEM_PROMPT,
        prompt: userPrompt,
        schema: voiceResponseSchema,
        temperature: 0.1,
      });

      const items = parsed.items.length > 0
        ? parsed.items
        : [
            {
              name: body.transcript.slice(0, 50),
              weight_grams: 100,
              calories: 150,
              protein_g: 5,
              fat_g: 5,
              carbs_g: 20,
            },
          ];

      return NextResponse.json({
        suggestedMealType: parsed.suggestedMealType ?? body.defaultMealType ?? "snack",
        items,
      });
    } catch (err) {
      console.error("Gemini voice parse error:", err);
    }
  }

  // Резервный Groq, если настроен ключ
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_CHAT_MODEL ?? "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_completion_tokens: 1000,
        }),
        signal: AbortSignal.timeout(18_000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = voiceResponseSchema.parse(JSON.parse(content));
          return NextResponse.json({
            suggestedMealType: parsed.suggestedMealType ?? body.defaultMealType ?? "snack",
            items: parsed.items,
          });
        }
      }
    } catch (err) {
      console.error("Groq voice parse error:", err);
    }
  }

  // Безопасный fallback, если AI недоступен
  return NextResponse.json({
    suggestedMealType: body.defaultMealType ?? "snack",
    items: [
      {
        name: body.transcript.slice(0, 50),
        weight_grams: 100,
        calories: 150,
        protein_g: 5,
        fat_g: 5,
        carbs_g: 20,
      },
    ],
  });
}
