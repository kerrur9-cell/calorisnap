import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sumTotals, type NutritionRow } from "@/lib/nutrition/macros";
import { decideAdvice, detectAdvicePreference, validateAdvice } from "@/lib/nutrition/advice";
import { generateGeminiJson } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 28;

const requestSchema = z.object({
  date: z.iso.date(),
  messages: z.array(z.discriminatedUnion("role", [
    z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(600) }),
    z.object({ role: z.literal("assistant"), content: z.string().trim().min(1).max(4000) }),
  ])).max(12),
});

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "nutrition_advice", strict: true,
    schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["normal", "goal_reached", "over_limit"] },
        message: { type: "string" }, highlights: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "object", properties: {
          name: { type: "string" }, portion: { type: "string" }, calories: { type: "number" },
          protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" }, reason: { type: "string" },
        }, required: ["name", "portion", "calories", "protein", "fat", "carbs", "reason"], additionalProperties: false } },
      },
      required: ["mode", "message", "highlights", "recommendations"], additionalProperties: false,
    },
  },
};

function previousRecommendationNames(messages: z.infer<typeof requestSchema>["messages"]) {
  return messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.content.match(/РЕКОМЕНДОВАНО:\s*([^\n]+)/u)?.[1]?.split("|") ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const deadline = Date.now() + 25_000;
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY);
  const groqKey = process.env.GROQ_API_KEY;
  if (!hasGemini && !groqKey) {
    return NextResponse.json({ error: "Ассистент пока не настроен" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  let body: z.infer<typeof requestSchema>;
  try { body = requestSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "Некорректное сообщение" }, { status: 400 }); }

  const [profileResult, mealsResult] = await Promise.all([
    supabase.from("profiles").select("daily_calorie_target,daily_protein_g,daily_fat_g,daily_carbs_g").eq("id", user.id).single(),
    supabase.from("meal_entries").select("meal_items(calories,protein_g,fat_g,carbs_g,custom_food_name)").eq("user_id", user.id).eq("entry_date", body.date).returns<Array<{ meal_items: (NutritionRow & { custom_food_name?: string | null })[] }>>(),
  ]);
  if (profileResult.error || mealsResult.error || !profileResult.data) return NextResponse.json({ error: "Не удалось загрузить дневник" }, { status: 503 });

  const profile = profileResult.data;
  const items = (mealsResult.data ?? []).flatMap((meal) => meal.meal_items);
  const totals = sumTotals(items);
  const targetCalories = profile.daily_calorie_target ?? 2000;
  const decision = decideAdvice(targetCalories, {
    proteinG: profile.daily_protein_g ?? 120, fatG: profile.daily_fat_g ?? 70, carbsG: profile.daily_carbs_g ?? 200,
  }, totals);
  const eaten = [...new Set(items.map((item) => item.custom_food_name).filter(Boolean))].slice(-20).join(", ") || "нет записей";
  const preference = detectAdvicePreference(body.messages.filter((message) => message.role === "user").at(-1)?.content ?? "");
  const previousNames = previousRecommendationNames(body.messages);
  const preferenceRule = preference === "ready_to_eat"
    ? "Пользователь явно НЕ ХОЧЕТ ГОТОВИТЬ. Дай только 1–2 действительно готовых к употреблению варианта: их можно купить и съесть сразу. Запрещены рецепты, овсянка, курица с овощами, салаты, нарезка ингредиентов, сковорода, духовка и фразы «легко приготовить»."
    : preference === "low_effort"
      ? "Пользователь хочет ленивый вариант: максимум 5 минут, без духовки и сложного приготовления."
      : "";
  const system = `Ты — русскоязычный помощник по питанию CaloriSnap. Сервер рассчитал: цель ${targetCalories} ккал; съедено ${Math.round(totals.calories)} ккал; остаток ${decision.caloriesRemaining} ккал; осталось Б ${decision.macrosRemaining.proteinG} г, Ж ${decision.macrosRemaining.fatG} г, У ${decision.macrosRemaining.carbsG} г; режим ${decision.mode}; уже съедено: ${eaten}. ${preferenceRule} Уже предлагались в этом диалоге: ${previousNames.join(", ") || "нет"}; не повторяй их. Верни только JSON по схеме. При normal дай только столько вариантов, сколько реально отвечает последнему сообщению (обычно 1–2, максимум 3), каждый не больше остатка. Не пиши шаблонные вступления, не пересказывай все макросы, не предлагай один и тот же набор еды при разных вопросах. При goal_reached и over_limit recommendations обязан быть пустым: не предлагай еду и не говори, что перекус ничего не испортит. В message — одно короткое человеческое предложение, highlights — только полезные короткие детали (0–2). Режим и математику не меняй.`;

  if (hasGemini) {
    try {
      const chatMessages = body.messages.length > 0
        ? body.messages
        : [{ role: "user" as const, content: "Что мне можно съесть сегодня?" }];

      const contents = chatMessages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

      const raw = await generateGeminiJson({
        systemPrompt: system,
        contents,
        temperature: 0.3,
        timeoutMs: Math.max(1, Math.min(18_000, deadline - Date.now())),
        maxTokens: 1800,
        responseJsonSchema: responseFormat.json_schema.schema,
      });

      const advice = validateAdvice(raw, decision, previousNames);
      if (advice) {
        return NextResponse.json({ advice }, { headers: { "Cache-Control": "private, no-store" } });
      }
    } catch (err) {
      console.error("Gemini advice error:", err);
    }
  }

  if (groqKey) {
    const models = [process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-20b", "openai/gpt-oss-20b"];
    for (const model of [...new Set(models)]) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: `${system}\nJSON schema: ${JSON.stringify(responseFormat.json_schema.schema)}` }, ...body.messages, ...(body.messages.length ? [] : [{ role: "user", content: "Что мне можно съесть сегодня?" }])], response_format: model.startsWith("openai/gpt-oss-") ? responseFormat : { type: "json_object" }, ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" } : {}), temperature: 0.3, max_completion_tokens: 1800 }),
          signal: AbortSignal.timeout(Math.min(7_000, remaining)),
        });
        if (!response.ok) {
          console.warn("Advice provider failed", { provider: "groq", model, status: response.status });
          continue;
        }
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content !== "string") continue;
        const advice = validateAdvice(JSON.parse(content), decision, previousNames);
        if (advice) return NextResponse.json({ advice }, { headers: { "Cache-Control": "private, no-store" } });
      } catch { /* Retry once with the backup Groq text model. */ }
    }
  }

  return NextResponse.json({ error: "Ассистент временно не ответил. Нажмите «Повторить»." }, { status: 503 });
}
