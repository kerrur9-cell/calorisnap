"use client";

import Link from "next/link";
import { Star, Play, Sparkles, Film, CheckCircle2, Minimize2 } from "lucide-react";
import type { Drama } from "@/lib/dramas/types";
import { useToggleFavorite } from "@/hooks/useDramas";
import { useDramaPlayer } from "@/context/DramaPlayerContext";

interface DramaCardProps {
  drama: Drama;
  onPlayClick?: (drama: Drama) => void;
}

export function DramaCard({ drama, onPlayClick }: DramaCardProps) {
  const toggleFav = useToggleFavorite();
  const { isDramaCompleted, getWatchedCount, openMiniPlayer } = useDramaPlayer();

  const completed = isDramaCompleted(drama) || drama.progress?.isCompleted;
  const watchedCount = getWatchedCount(drama.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFav.mutate(drama.id);
  };

  const progressPercent = drama.progress
    ? Math.min(100, Math.round((drama.progress.lastEpisodeNumber / Math.max(1, drama.totalEpisodes)) * 100))
    : completed
    ? 100
    : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-md backdrop-blur-xl transition-all duration-300 hover:border-primary/50 hover:shadow-xl">
      {/* Постер с оверлеем */}
      <Link
        href={`/dramas/${drama.id}`}
        className="relative aspect-[3/4] w-full overflow-hidden bg-muted/40 cursor-pointer block"
      >
        <img
          src={drama.coverUrl}
          alt={drama.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // Fallback thumbnail если YouTube картинка не загрузилась
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80";
          }}
        />

        {/* Градиент снизу постера для читаемости */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

        {/* Бейджи вверху постера */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          <div className="flex flex-wrap gap-1">
            {drama.isAiGenerated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/90 border border-violet-400/40 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                AI-сериал
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/85 border border-primary/40 px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm backdrop-blur-md">
                <Film className="h-3 w-3" />
                Дорама
              </span>
            )}

            {drama.hasRussianVoiceover && (
              <span className="rounded-full bg-emerald-600/85 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-md">
                RU Озвучка
              </span>
            )}
          </div>

          {/* Кнопка избранного */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={drama.isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/50 border border-white/20 text-white shadow-md backdrop-blur-md transition-all active:scale-90 hover:bg-black/70"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                drama.isFavorite ? "fill-amber-400 text-amber-400" : "text-white/80"
              }`}
            />
          </button>
        </div>

        {/* Кнопка быстрого запуска по центру */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transform-gpu scale-90 transition-transform duration-300 group-hover:scale-100">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </span>
        </div>

        {/* Нижний бейдж на постере: количество серий и прогресс */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between pointer-events-none">
          <span className="rounded-lg bg-black/60 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
            {drama.totalEpisodes} серий
          </span>

          {completed ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              Просмотрено
            </span>
          ) : watchedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/90 px-2 py-0.5 text-[11px] font-bold text-primary-foreground backdrop-blur-md shadow-sm">
              Серия {watchedCount}/{drama.totalEpisodes}
            </span>
          ) : null}
        </div>

        {/* Прогресс-бар просмотра */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div
              className={`h-full transition-all duration-300 ${completed ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </Link>

      {/* Информация о сериале */}
      <div className="flex flex-1 flex-col p-3.5">
        <Link href={`/dramas/${drama.id}`} className="block group-hover:text-primary transition-colors">
          <h3 className="line-clamp-1 text-sm font-bold tracking-tight text-foreground">
            {drama.title}
          </h3>
          {drama.originalTitle && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground mt-0.5">
              {drama.originalTitle}
            </p>
          )}
        </Link>

        {drama.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/90 leading-relaxed">
            {drama.description}
          </p>
        )}

        {/* Теги */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {drama.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Кнопка "Смотреть" и "В окне" */}
        <div className="mt-3.5 pt-2 border-t border-border/40 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const firstEp = drama.episodes?.[0] || {
                id: `ep-${drama.id}-1`,
                dramaId: drama.id,
                episodeNumber: 1,
                title: `${drama.title} - Серия 1`,
                videoId: drama.coverUrl.split("/vi/")[1]?.split("/")[0] || "PSKjllWGG0E",
                sourcePlatform: "youtube",
                durationSeconds: 1200,
                thumbnailUrl: drama.coverUrl,
                isAvailable: true,
                createdAt: drama.createdAt,
              };
              openMiniPlayer({
                key: `${drama.id}_ep_${firstEp.episodeNumber}`,
                drama,
                episode: firstEp,
                episodeNumber: firstEp.episodeNumber,
                totalEpisodesInDrama: drama.totalEpisodes,
              });
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 border border-violet-500/30 px-2 py-1 text-xs font-bold transition-all active:scale-95"
            title="Смотреть в плавающем окне"
          >
            <Minimize2 className="h-3 w-3" />
            <span>В окне</span>
          </button>

          <Link
            href={`/dramas/${drama.id}`}
            onClick={(e) => {
              if (onPlayClick) {
                e.preventDefault();
                onPlayClick(drama);
              }
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 text-xs font-bold transition-all active:scale-95"
          >
            <Play className="h-3 w-3 fill-current" />
            {completed ? "Заново" : watchedCount > 0 ? `С ${watchedCount + 1} сер.` : "Смотреть"}
          </Link>
        </div>
      </div>
    </div>
  );
}
