import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodItem } from "@/types/database";

export const runtime = "nodejs";

/**
 * Поиск продуктов по базе (pg_trgm уже проиндексирован).
 * Пустой запрос → популярные проверенные продукты.
 */
async function search(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.max(1, Math.min(Math.floor(Number(request.nextUrl.searchParams.get("limit"))) || 20, 50));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  if (q.length > 100) return NextResponse.json({ error: "Слишком длинный запрос" }, { status: 400 });
  const search = q.replace(/[\\%_,().]/g, " ").trim();

  let query = supabase
    .from("food_items")
    .select("id, name, name_local, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
    .order("is_verified", { ascending: false })
    .limit(limit);

  if (search) {
    // ilike покрывает и русские, и английские названия
    query = supabase
      .from("food_items")
      .select("id, name, name_local, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified")
      .or(`name.ilike.%${search}%,name_local.ilike.%${search}%`)
      .order("is_verified", { ascending: false })
      .limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data as Partial<FoodItem>[] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try { return await search(request); }
  catch { return NextResponse.json({ error: "Поиск временно недоступен" }, { status: 503 }); }
}
