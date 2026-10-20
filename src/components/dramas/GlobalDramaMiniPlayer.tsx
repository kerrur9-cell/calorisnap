"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Maximize2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useDramaPlayer } from "@/context/DramaPlayerContext";

/**
 * Глобальный плавающий мини-плеер ("В окне" / Picture-in-Picture).
 * Отображается поверх всех страниц приложения в правом нижнем углу над таб-баром.
 * Позволяет пользоваться сайтом (считать калории, смотреть вес, тренировки)
 * и одновременно смотреть китайские ИИ-сериалы в уголке экрана.
 */
export function GlobalDramaMiniPlayer() {
  const {
    isMiniPlayerOpen,
    miniItem,
    closeMiniPlayer,
    isMiniMuted,
    toggleMiniMute,
    isMiniPlaying,
    setMiniPlaying,
    playNextInMini,
    playPrevInMini,
    isWatched,
    markWatched,
  } = useDramaPlayer();

  const [isMinimized, setIsMinimized] = useState(false);

  if (!isMiniPlayerOpen || !miniItem) return null;

  const watched = isWatched(miniItem.drama.id, miniItem.episodeNumber);
  const embedUrl = `https://www.youtube.com/embed/${miniItem.episode.videoId}?autoplay=1&mute=${
    isMiniMuted ? 1 : 0
  }&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <aside
      aria-label="Плавающий мини-плеер сериала"
      className={`fixed z-50 transition-all duration-300 ease-out shadow-2xl rounded-2xl overflow-hidden border border-white/20 bg-black/95 backdrop-blur-xl ${
        isMinimized
          ? "bottom-20 right-3 w-56 h-14"
          : "bottom-20 right-3 w-72 sm:w-80 h-48 sm:h-52"
      }`}
    >
      {/* Верхняя строка управления мини-окном */}
      <div className="absolute top-0 inset-x-0 h-8 z-30 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between px-2 text-white">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
          <span className="text-[11px] font-bold truncate max-w-[140px]">
            {miniItem.drama.title}
          </span>
          <span className="rounded bg-primary/80 px-1 py-0.2 text-[9px] font-black shrink-0">
            Эп.{miniItem.episodeNumber}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Свернуть / Развернуть размер */}
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded-md hover:bg-white/20 active:scale-90 transition-all"
            title={isMinimized ? "Развернуть" : "Уменьшить"}
          >
            <span className="text-xs font-mono font-bold">
              {isMinimized ? "▲" : "▼"}
            </span>
          </button>

          {/* Перейти в полноэкранный раздел /dramas */}
          <Link
            href="/dramas"
            className="p-1 rounded-md hover:bg-white/20 active:scale-90 transition-all"
            title="Открыть на весь экран"
          >
            <Maximize2 className="h-3 w-3" />
          </Link>

          {/* Закрыть окно */}
          <button
            type="button"
            onClick={closeMiniPlayer}
            className="p-1 rounded-md hover:bg-red-500/40 active:scale-90 transition-all text-white/80 hover:text-white"
            title="Закрыть плеер"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Контент мини-плеера: Видео iframe */}
      {!isMinimized ? (
        <div className="relative h-full w-full pt-7 pb-8 bg-black">
          <iframe
            src={embedUrl}
            title={miniItem.episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full object-cover"
          />

          {/* Нижняя панель быстрых кнопок плеера */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-black/90 border-t border-white/10 flex items-center justify-between px-2.5 z-20">
            {/* Предыдущая серия */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={playPrevInMini}
                className="p-1 text-white/80 hover:text-white active:scale-90"
                title="Предыдущая серия"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={playNextInMini}
                className="p-1 text-white/80 hover:text-white active:scale-90"
                title="Следующая серия"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleMiniMute}
                className="p-1 text-white/80 hover:text-white active:scale-90 ml-1"
                title={isMiniMuted ? "Включить звук" : "Выключить звук"}
              >
                {isMiniMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Отметка "Просмотрено" */}
            <button
              type="button"
              onClick={() => markWatched(miniItem.drama.id, miniItem.episodeNumber, !watched)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all active:scale-95 ${
                watched
                  ? "bg-emerald-600/90 text-white"
                  : "bg-white/15 text-white/70 hover:text-white"
              }`}
              title="Отметить как просмотренное"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{watched ? "Просмотрено" : "Не просмотрено"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Свернутая плашка мини-плеера */
        <div className="h-full w-full flex items-center justify-between px-3 pt-6 bg-black">
          <p className="text-xs font-semibold text-white truncate max-w-[110px]">
            Серия {miniItem.episodeNumber}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMiniMute}
              className="text-white/80 hover:text-white"
            >
              {isMiniMuted ? <VolumeX className="h-3.5 w-3.5 text-amber-400" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={playNextInMini}
              className="text-white/80 hover:text-white"
              title="Следующая"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
