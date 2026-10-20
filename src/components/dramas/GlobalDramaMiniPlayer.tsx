"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Maximize2,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDramaPlayer } from "@/context/DramaPlayerContext";
import { DedicatedDramaPlayer } from "./DedicatedDramaPlayer";

/**
 * Глобальный плавающий мини-плеер ("В окне" / Picture-in-Picture).
 * СТРОГО ВЕРТИКАЛЬНЫЙ ФОРМАТ (9:16) как в TikTok и Reels.
 * Закреплен в правом нижнем углу над таб-баром, позволяя пользоваться любыми
 * разделами приложения CaloriSnap и смотреть ИИ-сериалы в вертикальном окне.
 */
export function GlobalDramaMiniPlayer() {
  const {
    isMiniPlayerOpen,
    miniItem,
    closeMiniPlayer,
    isMiniMuted,
    toggleMiniMute,
    playNextInMini,
    playPrevInMini,
    isWatched,
    markWatched,
  } = useDramaPlayer();

  const [isMinimized, setIsMinimized] = useState(false);

  if (!isMiniPlayerOpen || !miniItem) return null;

  const watched = isWatched(miniItem.drama.id, miniItem.episodeNumber);

  return (
    <aside
      aria-label="Вертикальный плавающий плеер сериала"
      className={`fixed z-50 transition-all duration-300 ease-out shadow-2xl overflow-hidden border border-white/25 bg-black/95 backdrop-blur-2xl select-none ${
        isMinimized
          ? "bottom-20 right-3.5 w-52 h-14 rounded-2xl"
          : "bottom-20 right-3.5 w-44 sm:w-52 aspect-[9/16] max-h-[360px] rounded-3xl"
      }`}
    >
      {/* Верхняя строка управления мини-окном */}
      <div className="absolute top-0 inset-x-0 h-10 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between px-2.5 text-white pointer-events-auto">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
          <span className="text-[11px] font-bold truncate max-w-[95px] sm:max-w-[120px]">
            {miniItem.drama.title}
          </span>
          <span className="rounded-full bg-primary/90 px-1.5 py-0.2 text-[9px] font-black shrink-0">
            {miniItem.episodeNumber}/{miniItem.totalEpisodesInDrama}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Свернуть / Развернуть размер */}
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/80 hover:text-white"
            title={isMinimized ? "Развернуть вертикальный плеер" : "Свернуть в плашку"}
          >
            {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {/* Перейти в полноэкранный раздел /dramas */}
          <Link
            href="/dramas"
            className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/80 hover:text-white"
            title="Открыть на весь экран"
          >
            <Maximize2 className="h-3 w-3" />
          </Link>

          {/* Закрыть окно */}
          <button
            type="button"
            onClick={closeMiniPlayer}
            className="p-1 rounded-full hover:bg-red-500/50 active:scale-90 transition-all text-white/80 hover:text-white"
            title="Закрыть окно"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Контент вертикального мини-плеера (9:16) */}
      {!isMinimized ? (
        <div className="relative h-full w-full flex flex-col justify-between bg-black">
          {/* Выделенный изолированный плеер */}
          <div className="absolute inset-0 z-10">
            <DedicatedDramaPlayer
              videoId={miniItem.episode.videoId}
              title={miniItem.episode.title}
              thumbnailUrl={miniItem.episode.thumbnailUrl || miniItem.drama.coverUrl}
              isMuted={isMiniMuted}
              autoplay={true}
              onEnded={playNextInMini}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Затемнение снизу для кнопок управления */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-20" />

          {/* Нижняя панель управления в вертикальном окне */}
          <div className="absolute bottom-2 inset-x-2 z-30 flex items-center justify-between text-white pointer-events-auto">
            {/* Кнопки переключения серий и звука */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={playPrevInMini}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                title="Предыдущая серия"
              >
                <SkipBack className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={playNextInMini}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                title="Следующая серия"
              >
                <SkipForward className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={toggleMiniMute}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                title={isMiniMuted ? "Включить звук" : "Выключить звук"}
              >
                {isMiniMuted ? (
                  <VolumeX className="h-3 w-3 text-amber-400" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Отметка "Просмотрено" */}
            <button
              type="button"
              onClick={() => markWatched(miniItem.drama.id, miniItem.episodeNumber, !watched)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border transition-all active:scale-95 ${
                watched
                  ? "bg-emerald-600/90 border-emerald-400/50 text-white shadow-sm"
                  : "bg-black/60 border-white/20 text-white/80 hover:text-white"
              }`}
              title={watched ? "Отмечено как просмотрено" : "Отметить просмотренным"}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{watched ? "Просмотрено" : "Готово?"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Свернутая плашка мини-плеера */
        <div className="h-full w-full flex items-center justify-between px-3 pt-4 bg-black/90">
          <p className="text-xs font-semibold text-white truncate max-w-[100px]">
            Серия {miniItem.episodeNumber}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMiniMute}
              className="p-1 text-white/80 hover:text-white"
            >
              {isMiniMuted ? <VolumeX className="h-3.5 w-3.5 text-amber-400" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={playNextInMini}
              className="p-1 text-white/80 hover:text-white"
              title="Следующая серия"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
