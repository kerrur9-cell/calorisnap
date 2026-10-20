"use client";

import { X, Play, CheckCircle2, Film } from "lucide-react";
import type { DramaEpisode } from "@/lib/dramas/types";
import { useDramaPlayer } from "@/context/DramaPlayerContext";

interface EpisodePickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dramaTitle: string;
  episodes: DramaEpisode[];
  currentEpisodeNumber: number;
  lastWatchedEpisodeNumber?: number;
  onSelectEpisode: (episode: DramaEpisode) => void;
}

export function EpisodePickerDrawer({
  isOpen,
  onClose,
  dramaTitle,
  episodes,
  currentEpisodeNumber,
  lastWatchedEpisodeNumber = 0,
  onSelectEpisode,
}: EpisodePickerDrawerProps) {
  const { isWatched: checkWatched, markWatched } = useDramaPlayer();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Затемняющий бэкдроп */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Выдвижная панель снизу */}
      <div className="relative z-10 max-h-[75dvh] w-full max-w-md mx-auto rounded-t-3xl border-t border-white/15 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl flex flex-col">
        {/* Ручка свайпа */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

        {/* Заголовок панели */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div>
            <h3 className="text-base font-bold text-foreground line-clamp-1">
              {dramaTitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Все серии ({episodes.length}) · Текущая: {currentEpisodeNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            aria-label="Закрыть список серий"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Быстрые чипсы-кнопки серий для удобного перехода */}
        <div className="py-2 flex gap-1.5 overflow-x-auto scrollbar-none border-b border-border/40">
          {episodes.map((ep) => {
            const isCurrent = ep.episodeNumber === currentEpisodeNumber;
            const isWatched = ep.episodeNumber < currentEpisodeNumber || ep.episodeNumber <= lastWatchedEpisodeNumber;
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => {
                  onSelectEpisode(ep);
                  onClose();
                }}
                className={`shrink-0 flex items-center justify-center h-8 min-w-8 px-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isWatched
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {ep.episodeNumber}
              </button>
            );
          })}
        </div>

        {/* Подробный список серий со скроллом */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 py-2 space-y-1">
          {episodes.map((ep) => {
            const isCurrent = ep.episodeNumber === currentEpisodeNumber;
            const isWatched = checkWatched(ep.dramaId, ep.episodeNumber) || (ep.episodeNumber <= lastWatchedEpisodeNumber && !isCurrent);

            return (
              <div
                key={ep.id}
                className={`w-full flex items-center justify-between gap-2 p-2 rounded-2xl transition-all ${
                  isCurrent
                    ? "bg-primary/15 border border-primary/40 text-foreground"
                    : "hover:bg-muted/40 text-foreground"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectEpisode(ep);
                    onClose();
                  }}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {/* Превью / иконка серии */}
                  <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-xl bg-muted/60 border border-border/50">
                    {ep.thumbnailUrl ? (
                      <img
                        src={ep.thumbnailUrl}
                        alt={ep.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                        <Play className="h-5 w-5 fill-white text-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Инфо серии */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs truncate">
                        {ep.title}
                      </span>
                      {isWatched && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {ep.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {ep.description}
                      </p>
                    )}
                    <span className="inline-block mt-0.5 text-[10px] text-muted-foreground/80 font-medium">
                      Серия {ep.episodeNumber}
                    </span>
                  </div>
                </button>

                {/* Быстрая кнопка отметки просмотренного */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    markWatched(ep.dramaId, ep.episodeNumber, !isWatched);
                  }}
                  className={`shrink-0 p-2 rounded-xl transition-colors ${
                    isWatched
                      ? "text-emerald-500 hover:text-emerald-600"
                      : "text-muted-foreground/40 hover:text-foreground"
                  }`}
                  title={isWatched ? "Снять отметку" : "Отметить как просмотренное"}
                >
                  <CheckCircle2 className={`h-4 w-4 ${isWatched ? "fill-emerald-500 text-white" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
