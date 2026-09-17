"use client";

import Link from "next/link";
import { Camera, Droplets, BarChart3, User, UtensilsCrossed } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/day", label: "День", icon: UtensilsCrossed },
  { href: "/stats", label: "Статистика", icon: BarChart3 },
  { href: "/water", label: "Вода", icon: Droplets },
  { href: "/profile", label: "Профиль", icon: User },
];

/** Нижний таб-бар. Камера — отдельная акцентная кнопка по центру. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav style={{ paddingBottom: "env(safe-area-inset-bottom)" }} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-between px-2">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}

        {/* Центральная кнопка камеры */}
        <Link
          href="/camera"
          className="relative -top-5 flex flex-col items-center justify-center"
        >
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
              pathname === "/camera"
                ? "bg-primary ring-4 ring-primary/25"
                : "bg-primary",
            )}
          >
            <Camera className="h-6 w-6 text-primary-foreground" />
          </span>
          <span className="mt-1 text-[10px] font-medium text-primary">Фото</span>
        </Link>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
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
}: {
  href: string;
  label: string;
  icon: typeof User;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
