import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "weekly_ai_review",
    strict: true,
    schema: {
      type: "object",
      properties: {
        summaryHeadline: { type: "string" },
        deepAnalysis: { type: "string" },
        keyStrength: { type: "string" },
        nextWeekFocus: { type: "string" },
        habitChallenge: { type: "string" },
      },
      required: [
        "summaryHeadline",
        "deepAnalysis",
        "keyStrength",
        "nextWeekFocus",
        "habitChallenge",
      ],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Ты — ведущий AI-нутрициолог CaloriSnap.
Твоя задача — составить профессиональный, тактичный и глубокий еженедельный обзор питания пользователя.
Правила:
- Опирайся на точные переданные числа (калории, белок, перепад будни/выходные).
- Никакого шейминга или чувства вины! Любое превышение рассматривай как опыт и поиск баланса.
- Предложи один конкретный, легко выполнимый челлендж-привычку на следующую неделю.
- Верни ответ ТОЛЬКО в формате JSON по схеме.`;

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

  try {
    const userPrompt = `Данные за прошедшую неделю:
- Заполнено дней: ${body.daysLogged} из 7
- Средняя калорийность: ${body.avgCalories} ккал (цель: ${body.targetCalories} ккал)
- Процент попадания в коридор нормы: ${body.adherencePercent}%
- Средний белок: ${body.avgProteinG} г (цель: ${body.targetProteinG} г)
- Разница между выходными и буднями: ${body.weekendVsWeekdayDeltaKcal > 0 ? `+${body.weekendVsWeekdayDeltaKcal}` : body.weekendVsWeekdayDeltaKcal} ккал
- Самые калорийные приёмы пищи: ${body.topCalorieMeals.map((m) => `${m.title} (${m.calories} ккал)`).join("; ")}

Проведи глубокий разбор и сформулируй вдохновляющее резюме.`;

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
          { role: "user", content: userPrompt },
        ],
        response_format: responseFormat,
        temperature: 0.3,
        max_completion_tokens: 1200,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Groq status ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty model response");

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      {
        summaryHeadline: `Неделя закрыта: ${body.daysLogged} дней учёта`,
        deepAnalysis: `Средняя калорийность составила ${body.avgCalories} ккал при цели ${body.targetCalories} ккал.`,
        keyStrength: "Регулярность ведения дневника",
        nextWeekFocus: "Удержание целевого коридора калорий",
        habitChallenge: "Выпивать стакан воды перед каждым приёмом пищи",
      },
      { status: 200 }
    );
  }
}
