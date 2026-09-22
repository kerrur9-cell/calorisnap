import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiJson } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  ingredients: z.array(z.string().trim().min(1).max(60)).min(1).max(15),
  remainingCalories: z.number().finite(),
  remainingProtein: z.number().finite().optional(),
  remainingFat: z.number().finite().optional(),
  remainingCarbs: z.number().finite().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
});

const ingredientItemSchema = z.object({
  name: z.string(),
  weight_grams: z.number().positive(),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
});

const recipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cookingTimeMinutes: z.number().positive(),
  difficulty: z.enum(["easy", "medium"]),
  ingredients: z.array(ingredientItemSchema).min(1),
  instructions: z.array(z.string()).min(1),
  totalCalories: z.number().nonnegative(),
  totalProtein: z.number().nonnegative(),
  totalFat: z.number().nonnegative(),
  totalCarbs: z.number().nonnegative(),
});

const recipesResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1),
});

const SYSTEM_PROMPT = `Ты — профессиональный шеф-повар и нутрициолог CaloriSnap.
Твоя задача — составить 2 практичных, простых и вкусных рецепта строго из ингредиентов пользователя (или с добавлением базовых специй, капли масла или соли/воды).
ВАЖНЕЙШИЕ ПРАВИЛА:
1. Калорийность КАЖДОГО рецепта НЕ ДОЛЖНА превышать указанный лимит оставшихся калорий (или быть в разумных пределах 250-600 ккал, если лимит отрицательный/слишком мал).
2. Подбери ТОЧНЫЕ граммовки для каждого ингредиента так, чтобы сумма калорий и БЖУ всех ингредиентов равнялась totalCalories, totalProtein, totalFat, totalCarbs.
3. Инструкции должны быть пошаговыми, лаконичными и понятными.
4. Отвечай ТОЛЬКО валидным JSON формата:
{
  "recipes": [
    {
      "title": "Название",
      "description": "Описание",
      "cookingTimeMinutes": 15,
      "difficulty": "easy",
      "ingredients": [
        { "name": "Продукт", "weight_grams": 100, "calories": 150, "protein_g": 10, "fat_g": 5, "carbs_g": 15 }
      ],
      "instructions": ["Шаг 1", "Шаг 2"],
      "totalCalories": 350,
      "totalProtein": 25,
      "totalFat": 10,
      "totalCarbs": 35
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

  const calorieBudget = Math.max(200, Math.min(1200, Math.round(body.remainingCalories)));
  const userPrompt = `Ингредиенты в наличии: ${body.ingredients.join(", ")}.
Лимит калорий на блюдо: до ${calorieBudget} ккал.
Остаток белка: ${Math.max(0, Math.round(body.remainingProtein ?? 30))} г.
Остаток жиров: ${Math.max(0, Math.round(body.remainingFat ?? 20))} г.
Остаток углеводов: ${Math.max(0, Math.round(body.remainingCarbs ?? 40))} г.
Приём пищи: ${body.mealType ?? "обед / ужин"}.
Предложи 2 отличных рецепта, использующих эти продукты с точными граммовками.`;

  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_FALLBACK_API_KEY);

  if (hasGemini) {
    try {
      const parsed = await generateGeminiJson({
        systemPrompt: SYSTEM_PROMPT,
        prompt: userPrompt,
        schema: recipesResponseSchema,
        temperature: 0.3,
      });

      return NextResponse.json({
        recipes: parsed.recipes,
      });
    } catch (err) {
      console.error("Gemini fridge recipe error:", err);
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
          max_completion_tokens: 1500,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = recipesResponseSchema.parse(JSON.parse(content));
          return NextResponse.json({
            recipes: parsed.recipes,
          });
        }
      }
    } catch (err) {
      console.error("Groq fridge recipe error:", err);
    }
  }

  return NextResponse.json(
    { error: "AI временно перегружен. Пожалуйста, попробуйте ещё раз через несколько секунд." },
    { status: 503 }
  );
}
