"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Star,
  ListVideo,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Drama, DramaEpisode, DramaWithEpisodes } from "@/lib/dramas/types";
import { DramaVideoPlayer } from "./DramaVideoPlayer";
import { EpisodePickerDrawer } from "./EpisodePickerDrawer";
import { useSaveDramaProgress, useToggleFavorite, useDrama } from "@/hooks/useDramas";

interface DramaFeedProps {
  initialDramas: Drama[];
  initialDramaId?: string;
  initialEpisodeNumber?: number;
}

export function DramaFeed({
  initialDramas,
  initialDramaId,
  initialEpisodeNumber = 1,
}: DramaFeedProps) {
  const [currentDramaIndex, setCurrentDramaIndex] = useState(() => {
    if (initialDramaId) {
      const idx = initialDramas.findIndex((d) => d.id === initialDramaId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const activeDramaSummary = initialDramas[currentDramaIndex] || initialDramas[0];
  const { data: activeDramaDetail, isLoading: isLoadingDrama } = useDrama(
    activeDramaSummary?.id,
  );

  const [currentEpNumber, setCurrentEpNumber] = useState(initialEpisodeNumber);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const saveProgress = useSaveDramaProgress();
  const toggleFavorite = useToggleFavorite();

  // Список серий активного сериала
  const episodes: DramaEpisode[] = activeDramaDetail?.episodes || [];
  const currentEpisode =
    episodes.find((ep) => ep.episodeNumber === currentEpNumber) ||
    episodes[0] || {
      id: "fallback-ep-1",
      dramaId: activeDramaSummary?.id || "drama-1",
      episodeNumber: 1,
      title: "Серия 1",
      videoId: "bBEDFJDQuc4",
      sourcePlatform: "youtube" as const,
      isAvailable: true,
      createdAt: new Date().toISOString(),
    };

  const hasNextEp = episodes.some((ep) => ep.episodeNumber === currentEpNumber + 1);
  const hasPrevEp = episodes.some((ep) => ep.episodeNumber === currentEpNumber - 1);
  const hasNextDrama = currentDramaIndex < initialDramas.length - 1;

  // При смене активного сериала восстанавливаем сохранённый прогресс пользователя
  useEffect(() => {
    if (activeDramaSummary?.progress?.lastEpisodeNumber) {
      setCurrentEpNumber(activeDramaSummary.progress.lastEpisodeNumber);
    } else {
      setCurrentEpNumber(1);
    }
  }, [activeDramaSummary?.id]);

  // Сохраняем прогресс просмотра при смене серии
  const handleSaveProgress = useCallback(
    (epNum: number, isCompleted: boolean = false) => {
      if (!activeDramaSummary) return;
      saveProgress.mutate({
        dramaId: activeDramaSummary.id,
        episodeId: currentEpisode.id,
        episodeNumber: epNum,
        isCompleted,
      });
    },
    [activeDramaSummary, currentEpisode.id, saveProgress],
  );

  const handleNext = useCallback(() => {
    if (hasNextEp) {
      const nextEp = currentEpNumber + 1;
      setCurrentEpNumber(nextEp);
      handleSaveProgress(nextEp);
    } else if (hasNextDrama) {
      // Сериал закончился — переходим к следующему сериалу
      setCurrentDramaIndex((prev) => prev + 1);
      setCurrentEpNumber(1);
    }
  }, [hasNextEp, hasNextDrama, currentEpNumber, handleSaveProgress]);

  const handlePrev = useCallback(() => {
    if (hasPrevEp) {
      const prevEp = currentEpNumber - 1;
      setCurrentEpNumber(prevEp);
      handleSaveProgress(prevEp);
    } else if (currentDramaIndex > 0) {
      // Предыдущий сериал
      setCurrentDramaIndex((prev) => prev - 1);
      setCurrentEpNumber(1);
    }
  }, [hasPrevEp, currentDramaIndex, currentEpNumber, handleSaveProgress]);

  // Обработка свайпов на тач-устройствах
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    // Свайп вверх -> следующая серия
    if (deltaY < -65) {
      handleNext();
    }
    // Свайп вниз -> предыдущая серия
    else if (deltaY > 65) {
      handlePrev();
    }
  };

  // Колёсико мыши и стрелки клавиатуры на ПК
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  if (!activeDramaSummary) {
    return (
      <div className="flex h-96 items-center justify-center text-center p-6 text-muted-foreground">
        Сериалы не найдены
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative h-[calc(100dvh-11rem)] sm:h-[calc(100dvh-12rem)] w-full rounded-3xl overflow-hidden bg-black shadow-2xl border border-border/40 select-none"
    >
      {/* Главный видеоплеер активной серии */}
      <DramaVideoPlayer
        dramaTitle={activeDramaSummary.title}
        totalEpisodes={episodes.length || activeDramaSummary.totalEpisodes}
        currentEpisode={currentEpisode}
        hasNextEpisode={hasNextEp || hasNextDrama}
        hasPrevEpisode={hasPrevEp || currentDramaIndex > 0}
        onNextEpisode={handleNext}
        onPrevEpisode={handlePrev}
        onOpenEpisodePicker={() => setIsDrawerOpen(true)}
        onEpisodeCompleted={(epNum) => handleSaveProgress(epNum, true)}
      />

      {/* Правая вертикальная панель действий (в стиле TikTok / DramaBox) */}
      <div className="absolute right-3 bottom-14 z-30 flex flex-col items-center gap-3.5 pointer-events-auto">
        {/* Избранное / Лайк */}
        <button
          type="button"
          onClick={() => toggleFavorite.mutate(activeDramaSummary.id)}
          className="group flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label={activeDramaSummary.isFavorite ? "В избранном" : "Добавить в избранное"}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg group-hover:bg-black/80">
            <Star
              className={`h-5 w-5 transition-colors ${
                activeDramaSummary.isFavorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-white"
              }`}
            />
          </span>
          <span className="text-[10px] font-bold text-white drop-shadow-md">
            {activeDramaSummary.isFavorite ? "В избранном" : "В закладки"}
          </span>
        </button>

        {/* Список всех серий */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="group flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Открыть список серий"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg group-hover:bg-black/80">
            <ListVideo className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-bold text-white drop-shadow-md">
            {currentEpNumber}/{episodes.length || activeDramaSummary.totalEpisodes}
          </span>
        </button>

        {/* Быстрый свайп-переход вверх/вниз */}
        <div className="flex flex-col gap-1.5 pt-1">
          {hasPrevEp && (
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white/80 hover:text-white backdrop-blur-md active:scale-90 transition-all"
              aria-label="Предыдущая серия"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}

          {(hasNextEp || hasNextDrama) && (
            <button
              type="button"
              onClick={handleNext}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white/80 hover:text-white backdrop-blur-md active:scale-90 transition-all"
              aria-label="Следующая серия"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Нижняя плашка с описанием и тегами */}
      <div className="absolute left-3 bottom-14 right-16 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1.5">
          {activeDramaSummary.isAiGenerated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/90 border border-violet-400/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md shadow-sm">
              <Sparkles className="h-3 w-3" />
              AI
            </span>
          )}
          {activeDramaSummary.hasRussianVoiceover && (
            <span className="rounded-full bg-emerald-600/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
              Озвучка
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-white line-clamp-1 drop-shadow-md">
          {activeDramaSummary.title}
        </h3>
        <p className="text-xs text-white/80 line-clamp-1 drop-shadow-sm mt-0.5">
          {currentEpisode.title}
        </p>
      </div>

      {/* Выдвижное меню со списком эпизодов */}
      <EpisodePickerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        dramaTitle={activeDramaSummary.title}
        episodes={episodes}
        currentEpisodeNumber={currentEpNumber}
        lastWatchedEpisodeNumber={activeDramaSummary.progress?.lastEpisodeNumber || 0}
        onSelectEpisode={(ep) => {
          setCurrentEpNumber(ep.episodeNumber);
          handleSaveProgress(ep.episodeNumber);
        }}
      />
    </div>
  );
}
