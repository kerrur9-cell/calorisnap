"use client";

import { useFriendView } from "@/context/FriendViewContext";
import { Eye, ArrowLeft } from "lucide-react";

export function GuestModeBanner() {
  const { isGuestView, viewedFriend, exitGuestView } = useFriendView();

  if (!isGuestView || !viewedFriend) return null;

  return (
    <aside
      aria-label="Режим гостевого просмотра"
      className="sticky top-0 z-50 border-b border-primary/30 bg-background/95 backdrop-blur-md px-3 py-2 shadow-md animate-in slide-in-from-top duration-200"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
            <Eye className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-foreground truncate">
                Профиль: {viewedFriend.displayName}
              </span>
              <span className="rounded-md bg-warning/20 border border-warning/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning shrink-0">
                Только просмотр
              </span>
            </div>
            {viewedFriend.code && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {viewedFriend.code}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={exitGuestView}
          className="btn-glossy spring-press flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Вернуться к себе
        </button>
      </div>
    </aside>
  );
}
