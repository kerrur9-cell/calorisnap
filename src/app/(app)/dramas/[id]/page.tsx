"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Play,
  Sparkles,
  Film,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { useDrama, useToggleFavorite, useSaveDramaProgress } from "@/hooks/useDramas";
import { DramaVideoPlayer } from "@/components/dramas/DramaVideoPlayer";
import { EpisodePickerDrawer } from "@/components/dramas/EpisodePickerDrawer";

export default function DramaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: drama, isLoading, error } = useDrama(id);
  const toggleFavorite = useToggleFavorite();
  const saveProgress = useSaveDramaProgress();

  const [activeEpisodeNumber, setActiveEpisodeNumber] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !drama) {
    return (
      <main className="min-h-dvh px-4 pt-6 text-center">
        <p className="text-sm text-muted-foreground">Сериал не найден</p>
        <Link
          href="/dramas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться к сериалам
        </Link>
      </main>
    );
  }

  const episodes = drama.episodes || [];
  const currentEpNum =
    activeEpisodeNumber ?? (drama.progress?.lastEpisodeNumber || 1);
  const currentEpisode =
    episodes.find((e) => e.episodeNumber === currentEpNum) || episodes[0];

  const hasNext = episodes.some((e) => e.episodeNumber === currentEpNum + 1);
  const hasPrev = episodes.some((e) => e.episodeNumber === currentEpNum - 1);

  const handleSelectEpisode = (epNumber: number) => {
    setActiveEpisodeNumber(epNumber);
    saveProgress.mutate({
      dramaId: drama.id,
      episodeId: episodes.find((e) => e.episodeNumber === epNumber)?.id || `ep-${epNumber}`,
      episodeNumber: epNumber,
    });
  };

  return (
    <main className="min-h-dvh pb-16">
      {/* Шапка с кнопкой назад и действиями */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <Link
          href="/dramas"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border/70 text-foreground active:scale-95 transition-all shadow-xs"
          aria-label="Назад к каталогу"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFavorite.mutate(drama.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border/70 text-foreground active:scale-95 transition-all shadow-xs"
            aria-label="В избранное"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                drama.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Плеер (если выбрана серия) или постер */}
      <div className="relative aspect-video w-full bg-black overflow-hidden shadow-lg border-b border-border/40">
        {currentEpisode ? (
          <DramaVideoPlayer
            dramaTitle={drama.title}
            totalEpisodes={drama.totalEpisodes}
            currentEpisode={currentEpisode}
            hasNextEpisode={hasNext}
            hasPrevEpisode={hasPrev}
            onNextEpisode={() => handleSelectEpisode(currentEpNum + 1)}
            onPrevEpisode={() => handleSelectEpisode(currentEpNum - 1)}
            onOpenEpisodePicker={() => setIsDrawerOpen(true)}
            onEpisodeCompleted={() => handleSelectEpisode(currentEpNum)}
          />
        ) : (
          <img
            src={drama.bannerUrl || drama.coverUrl}
            alt={drama.title}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Основная информация о сериале */}
      <div className="px-4 pt-4 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {drama.isAiGenerated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/90 border border-violet-400/40 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                AI-сериал
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/85 border border-primary/40 px-2.5 py-0.5 text-xs font-bold text-primary-foreground shadow-xs">
                <Film className="h-3.5 w-3.5" />
                Мини-дорама
              </span>
            )}

            {drama.hasRussianVoiceover && (
              <span className="rounded-full bg-emerald-600/85 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs">
                Русская озвучка
              </span>
            )}

            {drama.hasRussianSubtitles && !drama.hasRussianVoiceover && (
              <span className="rounded-full bg-amber-600/85 border border-amber-400/30 px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs">
                Русские субтитры
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {drama.title}
          </h1>
          {drama.originalTitle && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {drama.originalTitle}
            </p>
          )}
        </div>

        {/* Статистика */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-y border-border/40">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {drama.totalEpisodes} серий
          </span>
          <span>·</span>
          <span>Статус: {drama.status === "completed" ? "Завершён" : "В процессе"}</span>
          {drama.progress && (
            <>
              <span>·</span>
              <span className="text-primary font-semibold">
                Просмотрено до {drama.progress.lastEpisodeNumber} серии
              </span>
            </>
          )}
        </div>

        {/* Описание */}
        {drama.description && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              О сериале
            </h3>
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {drama.description}
            </p>
          </div>
        )}

        {/* Теги */}
        {drama.tags && drama.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {drama.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-xl bg-muted/80 border border-border/50 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Список серий */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">
              Все серии ({episodes.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              Последовательный просмотр
            </span>
          </div>

          <div className="space-y-2">
            {episodes.map((ep) => {
              const isCurrent = ep.episodeNumber === currentEpNum;
              const isWatched =
                ep.episodeNumber <= (drama.progress?.lastEpisodeNumber || 0);

              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => handleSelectEpisode(ep.episodeNumber)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                    isCurrent
                      ? "border-primary/50 bg-primary/10 shadow-sm"
                      : "border-border/60 bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isWatched
                          ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ep.episodeNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                        {ep.title}
                      </p>
                      {ep.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {ep.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Play className="h-3 w-3 fill-current" />
                        Сейчас
                      </span>
                    ) : isWatched ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Модальное окно выбора серий */}
      <EpisodePickerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        dramaTitle={drama.title}
        episodes={episodes}
        currentEpisodeNumber={currentEpNum}
        lastWatchedEpisodeNumber={drama.progress?.lastEpisodeNumber || 0}
        onSelectEpisode={(ep) => handleSelectEpisode(ep.episodeNumber)}
      />
    </main>
  );
}
