"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, Sparkles, Flame, User, UtensilsCrossed } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useFriendView } from "@/context/FriendViewContext";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/day", label: "День", icon: UtensilsCrossed },
  { href: "/burn", label: "Расход", icon: Flame },
  { href: "/hub", label: "Хаб", icon: Sparkles },
  { href: "/profile", label: "Профиль", icon: User },
];

/** Нижний таб-бар с мгновенным откликом (0ms prefetching + optimistic highlight). */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isGuestView } = useFriendView();
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
    if (!isGuestView) {
      router.prefetch("/camera");
    }

    // В свободное время (через 1с) прогреваем кэш данных для AI Хаба и Профиля
    const timer = setTimeout(() => {
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
  }, [router, queryClient, isGuestView]);

  return (
    <nav
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.35rem)" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-card/85 backdrop-blur-2xl shadow-xl transform-gpu"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-3">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink
            key={tab.href}
            {...tab}
            active={pendingHref ? pendingHref === tab.href : pathname.startsWith(tab.href)}
            onClick={() => setPendingHref(tab.href)}
          />
        ))}

        {/* Центральная кнопка камеры */}
        {isGuestView ? (
          <button
            type="button"
            onClick={() => alert("В режиме просмотра профиля друга добавление фото недоступно")}
            className="relative -top-4 flex flex-col items-center justify-center opacity-60 cursor-not-allowed"
            aria-label="В режиме просмотра добавление фото недоступно"
          >
            <span className="btn-glossy flex h-13 w-13 items-center justify-center rounded-full bg-muted border border-border/60 shadow-sm text-muted-foreground">
              <Camera className="h-6 w-6 stroke-[1.8]" />
            </span>
            <span className="mt-1 text-[10px] font-semibold text-muted-foreground">
              Фото
            </span>
          </button>
        ) : (
          <Link
            href="/camera"
            prefetch={true}
            onClick={() => setPendingHref("/camera")}
            className="relative -top-4 flex flex-col items-center justify-center group"
            aria-label="Сфотографировать еду"
          >
            <span
              className={cn(
                "btn-glossy spring-press flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-all duration-300",
                (pendingHref === "/camera" || pathname === "/camera")
                  ? "bg-primary ring-4 ring-primary/25 shadow-primary/40 scale-105"
                  : "bg-primary shadow-primary/30 group-hover:scale-105",
              )}
            >
              <Camera className="h-6 w-6 text-primary-foreground stroke-[2.2]" />
            </span>
            <span
              className={cn(
                "mt-1 text-[10px] font-semibold tracking-tight transition-colors",
                (pendingHref === "/camera" || pathname === "/camera")
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              Фото
            </span>
          </Link>
        )}

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
        "spring-press flex min-h-12 min-w-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl py-1 px-2.5 text-[11px] font-medium transition-all duration-200",
        active
          ? "text-primary font-bold"
          : "text-muted-foreground hover:text-foreground active:scale-95",
      )}
    >
      <div
        className={cn(
          "flex h-7 w-10 items-center justify-center rounded-full transition-all duration-200",
          active ? "bg-primary-soft/90 shadow-2xs" : "bg-transparent",
        )}
      >
        <Icon className={cn("h-4.5 w-4.5 transition-transform", active ? "stroke-[2.4]" : "stroke-[1.8]")} />
      </div>
      <span className="leading-none">{label}</span>
    </Link>
  );
}
