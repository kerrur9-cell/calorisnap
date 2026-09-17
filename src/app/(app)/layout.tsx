import { TabBar } from "@/components/app/TabBar";
import { ThemeSync } from "@/components/app/ThemeSync";
import { createClient, getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  const user = await getUser();
  if (!user) redirect("/login");

  // Проверяем, прошёл ли пользователь онбординг
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (error) throw new Error("Не удалось загрузить профиль");

  // Не даём превышать: гость и не-онбординг → ведём на онбординг
  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <ThemeSync />
      {/* Один скролл-контейнер с отступом под таб-бар */}
      <div className="pb-24">{children}</div>
      <TabBar />
    </div>
  );
}
