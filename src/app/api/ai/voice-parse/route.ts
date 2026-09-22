import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "parsed_voice_meal",
    strict: true,
    schema: {
      type: "object",
      properties: {
        suggestedMealType: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner", "snack"],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              weight_grams: { type: "number" },
              calories: { type: "number" },
              protein_g: { type: "number" },
              fat_g: { type: "number" },
              carbs_g: { type: "number" },
            },
            required: ["name", "weight_grams", "calories", "protein_g", "fat_g", "carbs_g"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestedMealType", "items"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Ты — профессиональный пищевой парсер CaloriSnap.
Твоя задача — преобразовать голосовую фразу пользователя на русском языке в структурированный список продуктов с реалистичными граммовками и КБЖУ.
Стандартные ориентиры порций в России:
- 1 яйцо = 55 г (75 ккал, Б 6.5, Ж 5.5, У 0.5)
- 1 кусок хлеба = 30-35 г (80 ккал, Б 2.5, Ж 0.8, У 15)
- 1 чашка кофе с молоком / капучино / латте = 200-250 г (90-135 ккал, Б 5-7, Ж 4-6, У 9-13)
- 1 тарелка каши / супа = 200-250 г
- 1 яблоко / банан = 120-150 г
- 1 порция мяса / филе = 120-180 г
Верни ТОЛЬКО валидный JSON со списком продуктов и типом приёма пищи.`;

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

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    // Резервный парсинг без LLM при отсутствии ключа
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

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Пользователь сказал: "${body.transcript}". Тип по умолчанию: ${body.defaultMealType ?? "auto"}. Распознай продукты.`,
          },
        ],
        response_format: responseFormat,
        temperature: 0.1,
        max_completion_tokens: 1000,
      }),
      signal: AbortSignal.timeout(18_000),
    });

    if (!response.ok) {
      throw new Error(`Groq status ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty model response");

    const parsed = JSON.parse(content);
    const validItems = z.array(itemSchema).parse(parsed.items);
    const suggestedMealType = parsed.suggestedMealType ?? body.defaultMealType ?? "snack";

    return NextResponse.json({
      suggestedMealType,
      items: validItems,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Не удалось точно распознать состав еды голосом. Попробуйте сформулировать чётче или добавьте продукт через поиск.",
      },
      { status: 502 }
    );
  }
}
