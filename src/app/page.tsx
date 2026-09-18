import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

/** Корень: авторизованный → /day, иначе → /login */
export default function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  // Middleware already redirects unauthenticated visitors to /login.
  redirect("/day");
}
