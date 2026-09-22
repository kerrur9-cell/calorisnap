"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, Droplets, BarChart3, User, UtensilsCrossed } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { todayKey, cn } from "@/lib/utils";

const TABS = [
  { href: "/day", label: "День", icon: UtensilsCrossed },
  { href: "/stats", label: "Статистика", icon: BarChart3 },
  { href: "/water", label: "Вода", icon: Droplets },
  { href: "/profile", label: "Профиль", icon: User },
];

/** Нижний таб-бар с мгновенным откликом (0ms prefetching + optimistic highlight). */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prevPath, setPrevPath] = useState(pathname);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Сброс ожидаемого перехода при смене пути без вызова setState в useEffect
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setPendingHref(null);
  }

  // Немедленный фоновый предзапрос всех вкладок и данных
  useEffect(() => {
    TABS.forEach((tab) => router.prefetch(tab.href));
    router.prefetch("/camera");

    // В свободное время (через 1с) прогреваем кэш данных для Воды и Профиля
    const timer = setTimeout(() => {
      const today = todayKey();
      queryClient.prefetchQuery({
        queryKey: ["water", today],
        queryFn: async () => {
          const supabase = createClient();
          const { data: entries, error } = await supabase
            .from("water_entries")
            .select("id, amount_ml, created_at")
            .eq("entry_date", today)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return {
            total: (entries ?? []).reduce((a, w) => a + w.amount_ml!, 0),
            entries: entries ?? [],
          };
        },
        staleTime: 60 * 1000,
      });

      queryClient.prefetchQuery({
        queryKey: ["weight-history"],
        queryFn: async () => {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("weight_entries")
            .select("weight_kg, recorded_at")
            .order("recorded_at", { ascending: false })
            .limit(7);
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60 * 1000,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [router, queryClient]);

  return (
    <nav
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md transform-gpu"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-between px-2">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink
            key={tab.href}
            {...tab}
            active={pendingHref ? pendingHref === tab.href : pathname.startsWith(tab.href)}
            onClick={() => setPendingHref(tab.href)}
          />
        ))}

        {/* Центральная кнопка камеры */}
        <Link
          href="/camera"
          prefetch={true}
          onClick={() => setPendingHref("/camera")}
          className="relative -top-5 flex flex-col items-center justify-center"
        >
          <span
            className={cn(
              "spring-press flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
              (pendingHref === "/camera" || pathname === "/camera")
                ? "bg-primary ring-4 ring-primary/30 shadow-primary/40 scale-105"
                : "bg-primary shadow-primary/20",
            )}
          >
            <Camera className="h-6 w-6 text-primary-foreground" />
          </span>
          <span className="mt-1 text-[10px] font-medium text-primary">Фото</span>
        </Link>

        {TABS.slice(2).map((tab) => (
          <TabLink
            key={tab.href}
            {...tab}
            active={pendingHref ? pendingHref === tab.href : pathname.startsWith(tab.href)}
            onClick={() => setPendingHref(tab.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof User;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onClick}
      className={cn(
        "spring-press flex min-w-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
        active ? "text-primary font-bold scale-105" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5 transition-transform" />
      {label}
    </Link>
  );
}
