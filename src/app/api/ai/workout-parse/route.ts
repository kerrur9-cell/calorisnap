import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";

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
4. Точно рассчитать РАСХОД КАЛОРИЙ (caloriesBurned, целое число ккал) С УЧЕТОМ параметров пользователя:
   - Пол: ${userGender === "female" ? "женский" : "мужской"}
   - Вес: ${userWeightKg} кг
   - Рост: ${userHeightCm} см
   - Возраст: ${userAge} лет
   Формулы энергозатрат:
   - Кардио: MET * вес_кг * (минуты / 60). (Бег 8 км/ч MET ~8.3; ходьба в гору MET ~7.0; эллипс MET ~6.5; скакалка MET ~10).
   - Силовые / тренажеры: 1 подход средней тяжести сжигает около ${Math.round(userWeightKg * 0.07)} ккал (включая EPOC и отдых). Базовые упражнения на ноги/ягодицы (ягодичный мостик, жим ногами, приседания) тратят в 1.3–1.5 раза больше калорий, чем руки или пресс.
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

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Не удалось распознать упражнение";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
