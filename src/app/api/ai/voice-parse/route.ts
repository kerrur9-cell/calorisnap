import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { voiceResponseSchema } from "@/lib/voice/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  transcript: z.string().trim().max(500).optional(),
  audioBase64: z.string().min(20).optional(),
  mimeType: z.string().default("audio/webm"),
  defaultMealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
}).refine((data) => Boolean(data.transcript || data.audioBase64), {
  message: "Требуется текст фразы или аудиозапись",
});

const SYSTEM_PROMPT = `Ты — умный нутрициолог и голосовой ассистент CaloriSnap.
Твоя задача — проанализировать голосовое аудиосообщение или текстовую фразу пользователя на русском языке.

Стандартные ориентиры порций в России (если пользователь не назвал точный вес):
- 1 яйцо = 55 г (75 ккал, Б 6.5, Ж 5.5, У 0.5)
- 1 кусок хлеба = 30-35 г (80 ккал, Б 2.5, Ж 0.8, У 15)
- 1 чашка кофе с молоком / капучино = 200-220 г (90-110 ккал, Б 4-6, Ж 3.5-5, У 8-11)
- 1 чашка чёрного кофе / эспрессо / чай без сахара = 2-5 ккал
- 1 тарелка каши / супа = 200-250 г
- 1 яблоко / банан = 120-150 г
- 1 порция мяса / птицы / рыбы = 120-160 г

Определи сценарий (поле "status"):
1. "success": пользователь назвал конкретные блюда, продукты или напитки для записи.
   - Извлеки все продукты в массив "items" с реалистичным весом и КБЖУ.
   - В "aiResponse" дай краткое дружелюбное подтверждение (1 предложение), например: "Записал 2 яйца, тост и кофе (~240 ккал). Проверьте граммовки перед сохранением."
   - В "suggestedMealType" укажи приём пищи ("breakfast", "lunch", "dinner" или "snack").

2. "clarification_needed": названо размытое блюдо без порции (например, "я поел суп" или "съел пирожок").
   - Добавь наиболее вероятную стандартную порцию в "items".
   - В "aiResponse" укажи сделанные допущения: "Записал стандартную порцию борща (250 г). Вы можете скорректировать граммовку или тип блюда."

3. "question_answered": пользователь задал вопрос о калорийности, КБЖУ, диете, похудении или полезных свойствах еды (например: "сколько калорий в банане?", "что лучше съесть на ужин?", "можно ли есть фрукты вечером?").
   - В "items" верни пустой массив [] (или продукт из вопроса, если уместно).
   - В "aiResponse" дай экспертный, лаконичный (2-3 предложения), практичный и доброжелательный ответ нутрициолога.

4. "not_food": фраза не связана с едой, здоровьем или дневником (например: "привет как дела", "какая сегодня погода", "включи музыку", "что ты умеешь").
   - В "items" верни пустой массив [].
   - В "aiResponse" вежливо ответь: "Я голосовой ассистент CaloriSnap 🥗. Я считаю калории ваших блюд и подсказываю по КБЖУ. Назовите, что вы съели (например: «2 яйца и тост»), или задайте вопрос о питании!"

5. "empty": тишина, дыхание, неразборчивый шум или аудио слишком тихое.
   - В "items" верни пустой массив [].
   - В "aiResponse" скажи: "Не удалось разобрать слова. Похоже, звук был слишком тихим. Попробуйте надиктовать фразу ближе к микрофону или введите текст ниже."

Поле "transcript": точный расшифрованный текст пользователя на русском (если тишина/шум — верни пустую строку "").

Верни ТОЛЬКО строгий валидный JSON следующего формата:
{
  "transcript": "Расшифрованная фраза",
  "status": "success" | "clarification_needed" | "question_answered" | "not_food" | "empty",
  "suggestedMealType": "breakfast" | "lunch" | "dinner" | "snack",
  "items": [
    {
      "name": "Название блюда",
      "weight_grams": 100,
      "calories": 150,
      "protein_g": 10,
      "fat_g": 5,
      "carbs_g": 15
    }
  ],
  "aiResponse": "Умный ответ ассистента",
  "tips": "Короткая подсказка (по желанию)"
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

  if (hasGemini) {
    try {
      let contents;
      if (body.audioBase64) {
        const cleanMime = body.mimeType.split(";")[0].trim();
        contents = [
          {
            role: "user" as const,
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: body.audioBase64,
                },
              },
              {
                text: `Пользователь надиктовал голосовое сообщение в дневник питания CaloriSnap.
1. Расшифруй речь на русском языке в поле "transcript". Если запись пустая или это неразборчивый шум — оставь "" и поставь status="empty".
2. Определи статус: "success", "clarification_needed", "question_answered", "not_food" или "empty".
3. Если есть еда — рассчитай реалистичные граммы и точный КБЖУ в "items".
4. В поле "aiResponse" ВСЕГДА дай живой, умный и доброжелательный ответ на русском языке.
5. Предпочтительный приём пищи (если еда): ${body.defaultMealType ?? "auto"}.
Верни строгий JSON.`,
              },
            ],
          },
        ];
      } else {
        contents = [
          {
            role: "user" as const,
            parts: [
              {
                text: `Пользователь ввёл фразу: "${body.transcript}".
В поле "transcript" верни "${body.transcript}".
Определи статус ("success", "clarification_needed", "question_answered", "not_food", "empty").
Если это еда — извлеки позиции в "items". Если это вопрос о калориях/диете — ответь в "aiResponse". Если фраза не о еде — дружелюбно сориентируй.
В поле "aiResponse" обязательно дай понятный ответ на русском.
Предпочтительный приём пищи: ${body.defaultMealType ?? "auto"}.
Верни строгий JSON.`,
              },
            ],
          },
        ];
      }

      const parsed = await generateGeminiJson({
        systemPrompt: SYSTEM_PROMPT,
        contents,
        schema: voiceResponseSchema,
        temperature: 0.2,
      });

      let aiResponse = parsed.aiResponse?.trim() || "";
      if (!aiResponse) {
        if (parsed.items.length > 0) {
          const totalCal = Math.round(parsed.items.reduce((s, it) => s + it.calories, 0));
          aiResponse = `Распознано: ${parsed.items.map((i) => i.name).join(", ")} (~${totalCal} ккал). Проверьте граммовки.`;
        } else if (parsed.status === "question_answered") {
          aiResponse = "Ответил на ваш вопрос по питанию.";
        } else if (parsed.status === "not_food") {
          aiResponse = "Я ассистент питания CaloriSnap 🥗. Назовите съеденные блюда или спросите совет по КБЖУ.";
        } else {
          aiResponse = "Не удалось разобрать блюда. Попробуйте надиктовать ещё раз или введите текстом.";
        }
      }

      return NextResponse.json({
        transcript: parsed.transcript || body.transcript || "",
        status: parsed.status,
        suggestedMealType: parsed.suggestedMealType ?? body.defaultMealType ?? "snack",
        items: parsed.items,
        aiResponse,
        tips: parsed.tips,
      });
    } catch (err) {
      console.error("Gemini voice parse error:", err);
    }
  }

  // Резервный Groq (если передан текст или Gemini недоступен)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && body.transcript) {
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
            { role: "user", content: `Пользователь сказал: "${body.transcript}"` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
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
            transcript: body.transcript,
            status: parsed.status,
            suggestedMealType: parsed.suggestedMealType ?? body.defaultMealType ?? "snack",
            items: parsed.items,
            aiResponse: parsed.aiResponse || "Фраза обработана.",
            tips: parsed.tips,
          });
        }
      }
    } catch (err) {
      console.error("Groq voice parse error:", err);
    }
  }

  return NextResponse.json(
    {
      error: "Не удалось связаться с AI-сервисом распознавания речи.",
      aiResponse: "Сервис временно перегружен или аудио не удалось расшифровать. Пожалуйста, повторите фразу или введите название блюд вручную в поле ниже.",
      status: "empty",
      items: [],
    },
    { status: 502 }
  );
}
