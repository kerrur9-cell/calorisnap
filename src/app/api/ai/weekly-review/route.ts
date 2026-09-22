import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiJson } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  avgCalories: z.number(),
  targetCalories: z.number(),
  adherencePercent: z.number(),
  avgProteinG: z.number(),
  targetProteinG: z.number(),
  weekendVsWeekdayDeltaKcal: z.number(),
  topCalorieMeals: z.array(
    z.object({
      title: z.string(),
      calories: z.number(),
      proteinG: z.number(),
    })
  ),
  daysLogged: z.number(),
});

const reviewSchema = z.object({
  summaryHeadline: z.string(),
  deepAnalysis: z.string(),
  keyStrength: z.string(),
  nextWeekFocus: z.string(),
  habitChallenge: z.string(),
});

const SYSTEM_PROMPT = `Ты — ведущий AI-нутрициолог CaloriSnap.
Твоя задача — составить профессиональный, тактичный и глубокий еженедельный обзор питания пользователя.
Правила:
- Опирайся на точные переданные числа (калории, белок, перепад будни/выходные).
- Никакого шейминга или чувства вины! Любое превышение рассматривай как опыт и поиск баланса.
- Предложи один конкретный, легко выполнимый челлендж-привычку на следующую неделю.
- Верни ответ ТОЛЬКО в формате JSON:
{
  "summaryHeadline": "Заголовок недели",
  "deepAnalysis": "Развёрнутый анализ",
  "keyStrength": "Главная сила",
  "nextWeekFocus": "Фокус на след. неделю",
  "habitChallenge": "Челлендж"
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

  const userPrompt = `Данные за прошедшую неделю:
- Заполнено дней: ${body.daysLogged} из 7
- Средняя калорийность: ${body.avgCalories} ккал (цель: ${body.targetCalories} ккал)
- Процент попадания в коридор нормы: ${body.adherencePercent}%
- Средний белок: ${body.avgProteinG} г (цель: ${body.targetProteinG} г)
- Разница между выходными и буднями: ${body.weekendVsWeekdayDeltaKcal > 0 ? `+${body.weekendVsWeekdayDeltaKcal}` : body.weekendVsWeekdayDeltaKcal} ккал
- Самые калорийные приёмы пищи: ${body.topCalorieMeals.map((m) => `${m.title} (${m.calories} ккал)`).join("; ")}

Проведи глубокий разбор и сформулируй вдохновляющее резюме.`;

  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY);

  if (hasGemini) {
    try {
      const parsed = await generateGeminiJson({
        systemPrompt: SYSTEM_PROMPT,
        prompt: userPrompt,
        schema: reviewSchema,
        temperature: 0.2,
      });

      return NextResponse.json(parsed);
    } catch (err) {
      console.error("Gemini weekly review error:", err);
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
          temperature: 0.3,
          max_completion_tokens: 1200,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = reviewSchema.parse(JSON.parse(content));
          return NextResponse.json(parsed);
        }
      }
    } catch (err) {
      console.error("Groq weekly review error:", err);
    }
  }

  // Детерминированный fallback
  return NextResponse.json({
    summaryHeadline: `Неделя закрыта: ${body.daysLogged} дней учёта, средняя калорийность ${body.avgCalories} ккал.`,
    deepAnalysis: `Вы удерживали среднюю калорийность на уровне ${body.avgCalories} ккал при цели ${body.targetCalories} ккал. По белку средний результат составил ${body.avgProteinG} г из целевых ${body.targetProteinG} г.${
      body.weekendVsWeekdayDeltaKcal > 250
        ? ` Обратите внимание на выходные: они были сытнее будней в среднем на +${body.weekendVsWeekdayDeltaKcal} ккал.`
        : " Баланс между буднями и выходными был очень ровным."
    }`,
    keyStrength: "Регулярность ведения дневника и осознанность в выборе порций.",
    nextWeekFocus: "Плавное распределение белка с первого приёма пищи.",
    habitChallenge: "Добавлять порцию овощей или зелени к каждому обеду и ужину.",
  });
}
