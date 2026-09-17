import { getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

/** Корень: авторизованный → /day, иначе → /login */
export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getUser();
  redirect(user ? "/day" : "/login");
}