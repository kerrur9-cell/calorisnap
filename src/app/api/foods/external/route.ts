import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchOpenFoodFacts } from "@/lib/open-food-facts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Введите от 2 до 100 символов" }, { status: 400 });
  }
  try {
    const items = await searchOpenFoodFacts(query);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Open Food Facts временно недоступен. Попробуйте позже." }, { status: 503 });
  }
}
