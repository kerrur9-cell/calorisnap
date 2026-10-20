import { NextResponse } from "next/server";
import { z } from "zod";
import { detectEquipment } from "@/lib/workout/equipment-vision";
import { GYM_MACHINES } from "@/lib/workout/machines";
import { calculateParsedWorkoutCalories } from "@/lib/workout/calculator";

export const maxDuration = 25;

const equipmentDetectRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional().default("image/jpeg"),
  userWeightKg: z.number().optional().default(55),
  userGender: z.enum(["male", "female"]).optional().default("female"),
});

const equipmentDetectResponseSchema = z.object({
  machineId: z.string().nullable().optional(),
  uncertain: z.boolean().default(false),
  machineName: z.string().default("Тренажёр"),
  machineNameEn: z.string().optional().nullable(),
  category: z.enum(["cardio", "strength", "machine", "bodyweight"]).catch("machine"),
  targetMuscles: z.array(z.string()).default([]),
  recommendedSets: z.number().default(3),
  recommendedReps: z.number().default(12),
  recommendedMinutes: z.number().optional().nullable(),
  caloriesPerSet: z.number().default(6),
  caloriesPerMinute: z.number().optional().nullable(),
  techniqueTip: z.string().default("Выполняйте движение плавно, сохраняя правильную осанку."),
  safetyTip: z.string().default("Отрегулируйте упоры и сиденье перед началом упражнения."),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsedInput = equipmentDetectRequestSchema.safeParse(rawBody);

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: "Неверный формат запроса", details: parsedInput.error.format() },
        { status: 400 },
      );
    }

    const { imageBase64, mimeType, userWeightKg, userGender } = parsedInput.data;

    // Снимаем data: URL prefix, если передан
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const systemPrompt = `Ты эксперт по спортивному оборудованию тренажерных залов и фитнес-тренер CaloriSnap.
Пользователь сфотографировал тренажер или спортивный снаряд в зале.
Твоя задача:
1. Точно определить тип и название тренажера на русском языке (например: "Ягодичный мостик в тренажере", "Гакк-приседания", "Жим ногами 45°", "Тяга верхнего блока", "Смит-машина", "Эллиптический тренажер", "Беговая дорожка", "Степпер-лестница").
2. Указать английское общепринятое название (machineNameEn).
3. Определить категорию: "machine" (силовой тренажер/блочный), "cardio" (кардио), "strength" (свободный вес), "bodyweight".
4. Указать целевые мышцы (targetMuscles, список на русском).
5. Дать рекомендуемый стартовый протокол для девушки/пользователя:
   - recommendedSets (число подходов, например 3 или 4)
   - recommendedReps (число повторений, например 12 или 15)
   - recommendedMinutes (если кардио)
6. НЕ рассчитывай калории или MET: это делает отдельный калькулятор. caloriesPerSet верни 0, caloriesPerMinute null.
7. Дать понятный совет по правильной технике выполнения для максимального эффекта (techniqueTip, 1-2 предложения).
8. Дать совет по безопасности и правильной настройке сиденья/валиков (safetyTip).

Выбирай machineId из каталога ниже. Если нужного варианта нет — null. Если фото не позволяет уверенно определить оборудование, верни uncertain: true; не угадывай по форме одного валика.
Каталог: ${JSON.stringify(GYM_MACHINES.map(({ id, name, nameEn }) => ({ id, name, nameEn })))}
Отвечай СТРОГО валидным JSON:
{
  "machineId": string | null,
  "uncertain": boolean,
  "machineName": string,
  "machineNameEn": string,
  "category": "cardio" | "strength" | "machine" | "bodyweight",
  "targetMuscles": string[],
  "recommendedSets": number,
  "recommendedReps": number,
  "recommendedMinutes": number | null,
  "caloriesPerSet": number,
  "caloriesPerMinute": number | null,
  "techniqueTip": string,
  "safetyTip": string
}`;

    const result = await detectEquipment({ data: cleanBase64, mimeType }, systemPrompt, equipmentDetectResponseSchema);
    if (result.uncertain) {
      return NextResponse.json({ error: "Тренажёр плохо различим. Сфотографируйте его целиком с другого ракурса или выберите из каталога." }, { status: 422 });
    }
    const machine = GYM_MACHINES.find((item) => item.id === result.machineId);
    if (machine) {
      result.machineName = machine.name;
      result.machineNameEn = machine.nameEn;
      result.category = machine.category === "cardio" ? "cardio" : "machine";
      result.targetMuscles = machine.targetMuscles;
      result.techniqueTip = machine.techniqueTip;
    }

    // Физиологическая калибровка энергозатрат тренажера под вес пользователя
    const isCardio = result.category === "cardio";
    const sampleSets = Math.max(1, result.recommendedSets || 3);
    const computedTotal = calculateParsedWorkoutCalories({
      exerciseName: result.machineName,
      category: result.category,
      sets: sampleSets,
      reps: result.recommendedReps || 12,
      durationMinutes: result.recommendedMinutes || (isCardio ? 20 : undefined),
      userWeightKg,
      userGender,
    });

    const calibratedPerSet = isCardio ? undefined : Math.max(3, Math.round(computedTotal / sampleSets));
    const calibratedPerMinute = isCardio
      ? Math.max(3, Math.round(computedTotal / (result.recommendedMinutes || 20)))
      : undefined;

    return NextResponse.json({
      ...result,
      caloriesPerSet: calibratedPerSet ?? result.caloriesPerSet,
      caloriesPerMinute: calibratedPerMinute ?? result.caloriesPerMinute,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Не удалось распознать тренажер";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
