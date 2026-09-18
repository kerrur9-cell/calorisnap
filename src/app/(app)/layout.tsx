import { TabBar } from "@/components/app/TabBar";
import { ThemeSync } from "@/components/app/ThemeSync";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/database";
import { redirect } from "next/navigation";

/**
 * Оболочка авторизованной части приложения: проверка онбординга + таб-бар.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  // Middleware has already verified the session for this page request.
  // The profile read remains protected by Supabase RLS.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Reuse the same profile on the client instead of fetching it a second time.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw new Error("Не удалось загрузить профиль");

  // Не даём превышать: гость и не-онбординг → ведём на онбординг
  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <ThemeSync initialProfile={profile as Profile} />
      {/* Один скролл-контейнер с отступом под таб-бар */}
      <div className="pb-24">
        {children}
        <footer className="px-4 pb-2 text-center text-xs text-muted-foreground">
          Данные о части продуктов: <a href="https://world.openfoodfacts.org" className="underline">Open Food Facts</a> (ODbL)
        </footer>
      </div>
      <TabBar />
    </div>
  );
}
