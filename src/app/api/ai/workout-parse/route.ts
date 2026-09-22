import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { calculateParsedWorkoutCalories } from "@/lib/workout/calculator";

export const maxDuration = 25;

const workoutParseRequestSchema = z.object({
  text: z.string().min(1),
  userWeightKg: z.number().optional().default(55),
  userHeightCm: z.number().optional().default(165),
  userGender: z.enum(["male", "female"]).optional().default("female"),
  userAge: z.number().optional().default(25),
});

const workoutResponseSchema = z.object({
  exerciseName: z.string().default("Упражнение"),
  category: z.enum(["cardio", "strength", "machine", "bodyweight"]).catch("machine"),
  durationMinutes: z.number().optional().nullable(),
  sets: z.number().optional().nullable(),
  reps: z.number().optional().nullable(),
  weightKg: z.number().optional().nullable(),
  caloriesBurned: z.number().default(30),
  targetMuscles: z.array(z.string()).default([]),
  advice: z.string().default("Отличная работа! Продолжайте в том же духе."),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsedInput = workoutParseRequestSchema.safeParse(rawBody);

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: "Неверный формат запроса", details: parsedInput.error.format() },
        { status: 400 },
      );
    }

    const { text, userWeightKg, userHeightCm, userGender, userAge } = parsedInput.data;

    const systemPrompt = `Ты профессиональный спортивный физиолог и нутрициолог приложения CaloriSnap.
Пользователь описывает выполненное упражнение или тренировку (текстом или расшифровкой голоса).
Твоя задача:
1. Понять, какое именно упражнение/активность выполнена.
2. Определить категорию: "cardio" (кардио/бег/ходьба/эллипс), "strength" (свободные веса), "machine" (тренажеры), "bodyweight" (собственный вес).
3. Извлечь параметры: подходы (sets), повторения (reps), рабочий вес отягощения (weightKg) или длительность в минутах (durationMinutes).
4. Оценить расход калорий (caloriesBurned, целое число ккал):
   ВНИМАНИЕ: ОДНО силовое упражнение (3-4 подхода) длится суммарно всего ~4–7 минут и расходует около 15–45 ккал!
   НИ В КОЕМ СЛУЧАЕ НЕ ПУТАЙ 1 упражнение со всей часовой тренировкой в зале!
   4 подхода жима ногами или приседаний — это всего ~35–45 ккал (около 8–10 ккал на подход), а НЕ 150-200 ккал!
   Изоляция (руки, плечи, пресс) — всего 10–20 ккал на упражнение!
5. Указать основные целевые мышцы на русском (targetMuscles, 2-3 группы).
6. Дать короткий теплый совет по технике и пользе (advice, 1-2 предложения, дружелюбный тон).

Отвечай СТРОГО в формате JSON без markdown:
{
  "exerciseName": string (название на русском),
  "category": "cardio" | "strength" | "machine" | "bodyweight",
  "durationMinutes": number | null,
  "sets": number | null,
  "reps": number | null,
  "weightKg": number | null,
  "caloriesBurned": number,
  "targetMuscles": string[],
  "advice": string
}`;

    const result = await generateGeminiJson({
      systemPrompt,
      prompt: `Описание тренировки от пользователя: "${text}"`,
      schema: workoutResponseSchema,
      temperature: 0.2,
      timeoutMs: 15_000,
    });

    // Строгий физиологический расчет на сервере исключает любые завышения и галлюцинации LLM
    const exactCalories = calculateParsedWorkoutCalories({
      exerciseName: result.exerciseName,
      category: result.category,
      durationMinutes: result.durationMinutes,
      sets: result.sets,
      reps: result.reps,
      weightKg: result.weightKg,
      userWeightKg,
      userHeightCm,
      userGender,
      userAge,
    });

    return NextResponse.json({
      ...result,
      caloriesBurned: exactCalories,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Не удалось распознать упражнение";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
