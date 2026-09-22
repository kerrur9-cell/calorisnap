import { TabBar } from "@/components/app/TabBar";
import { ThemeSync } from "@/components/app/ThemeSync";
import { ScrollPhysics } from "@/components/app/ScrollPhysics";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/database";
import { redirect } from "next/navigation";

/**
 * Оболочка авторизованной части приложения: проверка онбординга + таб-бар.
 */
import { cache } from "react";

const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile, error } = await getCachedProfile(session.user.id);
  if (error) throw new Error("Не удалось загрузить профиль");

  // Не даём превышать: гость и не-онбординг → ведём на онбординг
  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-md overflow-x-hidden pt-[env(safe-area-inset-top)]">
      {/* Мягкие световые сферы для глубокого матового размытия (Apple Glass Ambient Orbs) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="animate-ambient absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="animate-ambient absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-water/10 blur-3xl" style={{ animationDelay: "-5s" }} />
        <div className="animate-ambient absolute top-2/3 -right-20 h-64 w-64 rounded-full bg-warning/10 blur-3xl" style={{ animationDelay: "-9s" }} />
      </div>

      <ThemeSync initialProfile={profile as Profile} />
      <ScrollPhysics />
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
