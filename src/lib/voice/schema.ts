import { z } from "zod";

export const voiceItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  weight_grams: z.number().finite().positive().max(5000),
  calories: z.number().finite().nonnegative().max(10000),
  protein_g: z.number().finite().nonnegative().max(500),
  fat_g: z.number().finite().nonnegative().max(500),
  carbs_g: z.number().finite().nonnegative().max(500),
});

export const voiceResponseSchema = z.object({
  transcript: z.string().default(""),
  status: z.enum([
    "success",               // Продукты найдены и корректно распознаны
    "clarification_needed",  // Продукты распознаны с допущениями по весу/порции
    "question_answered",     // Пользователь задал вопрос по питанию / КБЖУ / диете
    "not_food",              // Фраза не относится к питанию или дневнику
    "empty",                 // Тишина, неразборчивый звук или шум
  ]).default("success"),
  suggestedMealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  items: z.array(voiceItemSchema).default([]),
  aiResponse: z.string().default(""),
  tips: z.string().optional(),
});

export type VoiceItem = z.infer<typeof voiceItemSchema>;
export type VoiceResponse = z.infer<typeof voiceResponseSchema>;
