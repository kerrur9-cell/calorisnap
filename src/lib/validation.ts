import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export function resolveMealType(value: string | null) {
  const parsed = mealTypeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const hour = new Date().getHours();
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 22 ? "dinner" : "snack";
}
export const nutritionSchema = z.object({
  calories: z.number().finite().min(0).max(1000),
  protein: z.number().finite().min(0).max(100),
  fat: z.number().finite().min(0).max(100),
  carbs: z.number().finite().min(0).max(100),
});
export const weightSchema = z.number().finite().positive().max(5000);
export const foodNameSchema = z.string().trim().min(1).max(200);
