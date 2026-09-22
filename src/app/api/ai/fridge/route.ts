import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "fridge_recipes_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        recipes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              cookingTimeMinutes: { type: "number" },
              difficulty: { type: "string", enum: ["easy", "medium"] },
              ingredients: {
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
              instructions: {
                type: "array",
                items: { type: "string" },
              },
              totalCalories: { type: "number" },
              totalProtein: { type: "number" },
              totalFat: { type: "number" },
              totalCarbs: { type: "number" },
            },
            required: [
              "title",
              "description",
              "cookingTimeMinutes",
              "difficulty",
              "ingredients",
              "instructions",
              "totalCalories",
              "totalProtein",
              "totalFat",
              "totalCarbs",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["recipes"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Ты — профессиональный шеф-повар и нутрициолог CaloriSnap.
Твоя задача — составить 2 практичных, простых и вкусных рецепта строго из ингредиентов пользователя (или с добавлением базовых специй, капли масла или соли/воды).
ВАЖНЕЙШИЕ ПРАВИЛА:
1. Калорийность КАЖДОГО рецепта НЕ ДОЛЖНА превышать указанный лимит оставшихся калорий (или быть в разумных пределах 250-600 ккал, если лимит отрицательный/слишком мал).
2. Подбери ТОЧНЫЕ граммовки для каждого ингредиента так, чтобы сумма калорий и БЖУ всех ингредиентов равнялась totalCalories, totalProtein, totalFat, totalCarbs.
3. Инструкции должны быть пошаговыми, лаконичными и понятными.
4. Отвечай ТОЛЬКО валидным JSON по предоставленной схеме.`;

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
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    // Резервный рецепт без API ключа
    const firstIng = body.ingredients[0] ?? "Продукты";
    return NextResponse.json({
      recipes: [
        {
          title: `Быстрое блюдо из ${firstIng}`,
          description: "Простой рецепт на скорую руку с контролем калорий",
          cookingTimeMinutes: 15,
          difficulty: "easy",
          ingredients: body.ingredients.slice(0, 3).map((ing, idx) => ({
            name: ing,
            weight_grams: 100,
            calories: Math.round(calorieBudget / Math.min(body.ingredients.length, 3)),
            protein_g: idx === 0 ? 15 : 4,
            fat_g: 5,
            carbs_g: 10,
          })),
          instructions: [
            "Подготовьте и промойте ингредиенты.",
            "Нарежьте удобными кусочками.",
            "Обжарьте на сухой антипригарной сковороде или потушите с небольшим количеством воды до готовности.",
          ],
          totalCalories: calorieBudget,
          totalProtein: 25,
          totalFat: 12,
          totalCarbs: 25,
        },
      ],
    });
  }

  try {
    const userPrompt = `Ингредиенты в наличии: ${body.ingredients.join(", ")}.
Лимит калорий на блюдо: до ${calorieBudget} ккал.
Остаток белка: ${Math.max(0, Math.round(body.remainingProtein ?? 30))} г.
Остаток жиров: ${Math.max(0, Math.round(body.remainingFat ?? 20))} г.
Остаток углеводов: ${Math.max(0, Math.round(body.remainingCarbs ?? 40))} г.
Приём пищи: ${body.mealType ?? "обед / ужин"}.
Предложи 2 отличных рецепта, использующих эти продукты с точными граммовками.`;

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
        max_completion_tokens: 1500,
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
    const validRecipes = z.array(recipeSchema).parse(parsed.recipes);

    return NextResponse.json({
      recipes: validRecipes,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Не удалось сформировать рецепты. Попробуйте изменить список продуктов.",
      },
      { status: 502 }
    );
  }
}
