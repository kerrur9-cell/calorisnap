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
  name: z.string().trim().min(1),
  weight_grams: z.coerce.number().positive(),
  calories: z.coerce.number().nonnegative(),
  protein_g: z.coerce.number().nonnegative(),
  fat_g: z.coerce.number().nonnegative(),
  carbs_g: z.coerce.number().nonnegative(),
});

const recipeSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  cookingTimeMinutes: z.coerce.number().positive().default(15),
  difficulty: z.string().default("easy").transform((v) =>
    v.toLowerCase().includes("med") || v.toLowerCase().includes("средн") ? "medium" : "easy"
  ),
  ingredients: z.array(ingredientItemSchema).min(1),
  instructions: z.union([
    z.array(z.string()),
    z.string().transform((s) => s.split("\n").map((step) => step.trim()).filter(Boolean)),
  ]).transform((val) => (Array.isArray(val) && val.length > 0 ? val : ["Смешать или приготовить ингредиенты"])),
  totalCalories: z.coerce.number().nonnegative(),
  totalProtein: z.coerce.number().nonnegative(),
  totalFat: z.coerce.number().nonnegative(),
  totalCarbs: z.coerce.number().nonnegative(),
});

const recipesResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1),
});

const SYSTEM_PROMPT = `Ты — профессиональный шеф-повар и нутрициолог CaloriSnap.
Твоя задача — составить 2 практичных, простых и вкусных рецепта строго из ингредиентов пользователя (плюс базовые специи, капли масла или воды/соли).
ВАЖНЕЙШИЕ ПРАВИЛА:
1. Калорийность КАЖДОГО рецепта НЕ ДОЛЖНА превышать указанный лимит калорий на блюдо (обычно 250-600 ккал).
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

  const rawRemaining = Math.round(body.remainingCalories);
  const mealCalorieLimit = rawRemaining > 0 ? Math.min(rawRemaining, 600) : 400;

  const mealNameMap: Record<string, string> = {
    breakfast: "завтрак",
    lunch: "обед",
    dinner: "ужин",
    snack: "перекус",
  };
  const mealLabel = body.mealType ? mealNameMap[body.mealType] ?? body.mealType : "приём пищи";

  const userPrompt = `Ингредиенты пользователя: ${body.ingredients.join(", ")}.
Категория приёма пищи: ${mealLabel}.
Лимит калорий на блюдо: до ${mealCalorieLimit} ккал (не превышать ${mealCalorieLimit} ккал!).
Ориентир БЖУ на порцию: белок ~${Math.min(45, Math.max(15, Math.round(body.remainingProtein ?? 25)))} г, жиры ~${Math.min(25, Math.max(5, Math.round(body.remainingFat ?? 15)))} г, углеводы ~${Math.min(60, Math.max(10, Math.round(body.remainingCarbs ?? 30)))} г.
Составь 2 практичных, аппетитных рецепта с точным указанием граммовок каждого ингредиента и шагами приготовления.`;

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
        signal: AbortSignal.timeout(18_000),
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

  // Детерминированный надёжный fallback-рецепт из введённых продуктов
  const fallbackRecipes = generateDeterministicFridgeRecipes(body.ingredients, mealCalorieLimit, mealLabel);
  return NextResponse.json({ recipes: fallbackRecipes });
}

function generateDeterministicFridgeRecipes(ingredients: string[], calorieLimit: number, mealLabel: string) {
  const main = ingredients[0] || "Продукт";
  const secondary = ingredients[1] || "Овощи/зелень";

  const halfCal = Math.round(calorieLimit * 0.55);
  const restCal = Math.round(calorieLimit * 0.45);

  return [
    {
      title: `${capitalize(mealLabel)}: тёплый микс из ${main}`,
      description: `Быстрое и сбалансированное блюдо из имеющихся продуктов с минимальным временем приготовления.`,
      cookingTimeMinutes: 15,
      difficulty: "easy" as const,
      ingredients: [
        { name: main, weight_grams: 150, calories: halfCal, protein_g: Math.round(halfCal * 0.05), fat_g: Math.round(halfCal * 0.02), carbs_g: Math.round(halfCal * 0.06) },
        { name: secondary, weight_grams: 100, calories: restCal, protein_g: Math.round(restCal * 0.03), fat_g: Math.round(restCal * 0.02), carbs_g: Math.round(restCal * 0.07) },
      ],
      instructions: [
        `Промойте и нарежьте ${main} и ${secondary} удобными кусочками.`,
        `Разогрейте сковороду с каплей масла или используйте запекание.`,
        `Обжаривайте или тушите до готовности (10–12 минут), добавьте специи и соль по вкусу.`,
        `Подавайте тёплым в качестве основного блюда.`,
      ],
      totalCalories: halfCal + restCal,
      totalProtein: Math.round((halfCal * 0.05) + (restCal * 0.03)),
      totalFat: Math.round((halfCal * 0.02) + (restCal * 0.02)),
      totalCarbs: Math.round((halfCal * 0.06) + (restCal * 0.07)),
    },
    {
      title: `Лёгкий салат-боул из ${ingredients.slice(0, 3).join(" и ")}`,
      description: `Свежее блюдо с высоким содержанием клетчатки и оптимальным балансом калорий.`,
      cookingTimeMinutes: 10,
      difficulty: "easy" as const,
      ingredients: ingredients.slice(0, 3).map((item, idx) => {
        const cal = Math.round(calorieLimit / Math.min(3, ingredients.length));
        return {
          name: item,
          weight_grams: 100 + idx * 20,
          calories: cal,
          protein_g: Math.round(cal * 0.04),
          fat_g: Math.round(cal * 0.02),
          carbs_g: Math.round(cal * 0.05),
        };
      }),
      instructions: [
        `Подготовьте и измельчите ${ingredients.join(", ")}.`,
        `Выложите ингредиенты в глубокую тарелку или салатник.`,
        `Заправьте каплей лимонного сока, любимыми специями или каплей оливкового масла.`,
      ],
      totalCalories: calorieLimit,
      totalProtein: Math.round(calorieLimit * 0.04),
      totalFat: Math.round(calorieLimit * 0.02),
      totalCarbs: Math.round(calorieLimit * 0.05),
    },
  ];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
