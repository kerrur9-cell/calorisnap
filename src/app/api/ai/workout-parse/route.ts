import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { calculateDetailedWorkout } from "@/lib/workout/calculator";

export const maxDuration = 25;

const workoutParseRequestSchema = z.object({
  text: z.string().min(1),
  userWeightKg: z.number().optional().nullable(),
  userHeightCm: z.number().optional().nullable(),
  userGender: z.enum(["male", "female"]).optional().default("female"),
  userAge: z.number().optional().default(25),
});

const aiExtractionSchema = z.object({
  exerciseName: z.string().default("Физическая активность"),
  activityKey: z.string().default("general"),
  category: z.enum(["cardio", "strength", "machine", "bodyweight"]).catch("cardio"),
  durationMinutes: z.number().nullable().optional(),
  durationExplicitlyProvided: z.boolean().default(false),
  speedKmh: z.number().nullable().optional(),
  speedExplicitlyProvided: z.boolean().default(false),
  inclinePercent: z.number().nullable().optional(),
  inclineExplicitlyProvided: z.boolean().default(false),
  intensity: z.enum(["light", "moderate", "brisk", "vigorous"]).nullable().optional(),
  sets: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  weightKg: z.number().nullable().optional(),
  targetMuscles: z.array(z.string()).default([]),
  isAmbiguous: z.boolean().default(false),
  ambiguityNote: z.string().nullable().optional(),
  neutralCommentary: z.string().default(""),
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

    const systemPrompt = `Ты аналитический модуль структурирования данных физической активности приложения CaloriSnap.
Твоя задача — ТОЛЬКО распознать и структурировать информацию из текста пользователя.
Ты НЕ рассчитываешь калории! Калории рассчитываются отдельным физиологическим калькулятором на основе Compendium of Physical Activities и формул ACSM.

Правила распознавания:
1. "exerciseName": нормализованное понятное название активности на русском языке (например: "Быстрая ходьба на беговой дорожке", "Жим ногами 45°", "Бег на улице", "Приседания со штангой").
2. "category": строго одна из: "cardio", "strength", "machine", "bodyweight".
3. "durationMinutes": число минут, если пользователь ЕГО УКАЗАЛ. Если пользователь НЕ назвал время (например, "я бегал"), верни null, а "durationExplicitlyProvided": false. НЕ ВЫДУМЫВАЙ время!
4. "speedKmh": скорость в км/ч, ЕСЛИ указана (например, "со скоростью 6.7 км/ч" -> 6.7, "10 км/ч" -> 10). Если не указана — верни null, "speedExplicitlyProvided": false.
5. "inclinePercent": процент наклона беговой дорожки (например, "с наклоном 3%" -> 3, "без наклона" -> 0, "в гору 5%" -> 5).
   ВНИМАНИЕ: Если пользователь НЕ упоминал наклон, НЕ ПРИДУМЫВАЙ 0! Верни null и "inclineExplicitlyProvided": false.
6. "sets", "reps", "weightKg": число подходов, повторений и рабочий вес снаряда (штанга/гантель/тренажёр), если указаны в силовых упражнениях.
7. Неоднозначность ("isAmbiguous", "ambiguityNote"):
   Если скорость около 6.5–7.2 км/ч и неясно, был это шаг или бег — укажи neutral формулировку и отметь "isAmbiguous": true, "ambiguityNote": "При такой скорости возможна как очень быстрая ходьба, так и лёгкий бег трусцой".
8. "targetMuscles": 2-3 основные группы мышц на русском языке (например: ["Квадрицепсы", "Ягодицы", "Икры"]).
9. "neutralCommentary": КРАТКИЙ, объективный и научно обоснованный комментарий (1-2 предложения).
   ВАЖНО:
   - БЕЗ фамильярности, без бессмысленной похвалы ("Отличное начало!", "Так держать!").
   - БЕЗ категоричных медицинских суждений о том, кому подходит данная тренировка.
   - Пример правильного тона: "Быстрая ходьба задействует мышцы ног и стимулирует сердечно-сосудистую систему. Субъективная нагрузка зависит от индивидуального уровня подготовки."

Отвечай СТРОГО в формате JSON без markdown:
{
  "exerciseName": string,
  "activityKey": string,
  "category": "cardio" | "strength" | "machine" | "bodyweight",
  "durationMinutes": number | null,
  "durationExplicitlyProvided": boolean,
  "speedKmh": number | null,
  "speedExplicitlyProvided": boolean,
  "inclinePercent": number | null,
  "inclineExplicitlyProvided": boolean,
  "intensity": "light" | "moderate" | "brisk" | "vigorous" | null,
  "sets": number | null,
  "reps": number | null,
  "weightKg": number | null,
  "targetMuscles": string[],
  "isAmbiguous": boolean,
  "ambiguityNote": string | null,
  "neutralCommentary": string
}`;

    const ai = await generateGeminiJson({
      systemPrompt,
      prompt: `Описание тренировки от пользователя: "${text}"`,
      schema: aiExtractionSchema,
      temperature: 0.1,
      timeoutMs: 22_000,
    });

    // Отдельный математический расчёт расхода калорий (Compendium MET + ACSM)
    const detailedCalculation = calculateDetailedWorkout({
      exerciseName: ai.exerciseName,
      category: ai.category,
      durationMinutes: ai.durationMinutes,
      speedKmh: ai.speedKmh,
      inclinePercent: ai.inclinePercent,
      sets: ai.sets,
      reps: ai.reps,
      weightKg: ai.weightKg,
      userWeightKg,
      userHeightCm: userHeightCm ?? undefined,
      userGender: userGender ?? "female",
      userAge,
    });

    return NextResponse.json({
      exerciseName: ai.exerciseName,
      category: ai.category,
      activityKey: ai.activityKey,
      durationMinutes: ai.durationMinutes ?? null,
      durationExplicitlyProvided: ai.durationExplicitlyProvided,
      speedKmh: ai.speedKmh ?? null,
      speedExplicitlyProvided: ai.speedExplicitlyProvided,
      inclinePercent: ai.inclinePercent ?? null,
      inclineExplicitlyProvided: ai.inclineExplicitlyProvided,
      intensity: ai.intensity ?? null,
      sets: ai.sets ?? null,
      reps: ai.reps ?? null,
      weightKg: ai.weightKg ?? null,
      targetMuscles: ai.targetMuscles,
      isAmbiguous: ai.isAmbiguous,
      ambiguityNote: ai.ambiguityNote ?? null,
      advice: ai.neutralCommentary,
      commentary: ai.neutralCommentary,
      needsDuration: !ai.durationMinutes || !ai.durationExplicitlyProvided,
      needsWeight: !userWeightKg || userWeightKg <= 0,
      // Детальные физиологические результаты расчёта
      calculation: {
        grossCalories: detailedCalculation.grossCalories,
        activeCalories: detailedCalculation.activeCalories,
        met: detailedCalculation.met,
        calculationMethod: detailedCalculation.calculationMethod,
        explanation: detailedCalculation.explanation,
        userWeightUsedKg: detailedCalculation.userWeightKg,
        isWeightEstimated: detailedCalculation.isWeightEstimated,
        isDurationEstimated: detailedCalculation.isDurationEstimated,
      },
      // Обратная совместимость для полей caloriesBurned
      caloriesBurned: detailedCalculation.activeCalories,
      grossCalories: detailedCalculation.grossCalories,
      activeCalories: detailedCalculation.activeCalories,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Не удалось распознать упражнение";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
