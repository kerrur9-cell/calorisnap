import { createClient } from "./supabase/client";
import type { Json } from "@/types/database";

export async function saveMeal(input: {
  id: string; date: string; type: string; items: Json;
  photoPath?: string | null; analysis?: Json | null;
}) {
  const { data, error } = await createClient().rpc("save_meal", {
    p_id: input.id, p_date: input.date, p_type: input.type, p_items: input.items,
    p_photo: input.photoPath ?? null, p_analysis: input.analysis ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
