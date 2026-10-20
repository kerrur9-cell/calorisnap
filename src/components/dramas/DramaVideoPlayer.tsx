"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  ListVideo,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { DramaEpisode } from "@/lib/dramas/types";

interface DramaVideoPlayerProps {
  dramaTitle: string;
  totalEpisodes: number;
  currentEpisode: DramaEpisode;
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  onNextEpisode: () => void;
  onPrevEpisode: () => void;
  onOpenEpisodePicker: () => void;
  onEpisodeCompleted?: (epNumber: number) => void;
}

export function DramaVideoPlayer({
  dramaTitle,
  totalEpisodes,
  currentEpisode,
  hasNextEpisode,
  hasPrevEpisode,
  onOpenEpisodePicker,
  onNextEpisode,
  onPrevEpisode,
  onEpisodeCompleted,
}: DramaVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Сброс состояния при переключении серии
  useEffect(() => {
    setIsLoading(true);
    setVideoError(null);
    setIsPlaying(true);
  }, [currentEpisode.videoId]);

  // Слушаем события от YouTube IFrame API через postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === "onReady") {
          setIsLoading(false);
        } else if (parsed.event === "onStateChange") {
          // data === 0 означает конец видео (ENDED)
          if (parsed.info === 0 || parsed.data === 0) {
            setIsPlaying(false);
            if (onEpisodeCompleted) {
              onEpisodeCompleted(currentEpisode.episodeNumber);
            }
            if (hasNextEpisode) {
              // Автопереход к следующей серии через 1.5 секунды
              setTimeout(() => {
                onNextEpisode();
              }, 1200);
            }
          } else if (parsed.info === 1 || parsed.data === 1) {
            // PLAYING
            setIsLoading(false);
            setIsPlaying(true);
          } else if (parsed.info === 2 || parsed.data === 2) {
            // PAUSED
            setIsPlaying(false);
          } else if (parsed.info === 3 || parsed.data === 3) {
            // BUFFERING
            setIsLoading(true);
          }
        } else if (parsed.event === "onError") {
          setVideoError("Видео временно недоступно для встраивания.");
          setIsLoading(false);
        }
      } catch {
        // Игнорируем не-JSON сообщения
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentEpisode.episodeNumber, hasNextEpisode, onNextEpisode, onEpisodeCompleted]);

  // Автоскрытие панели управления через 3 секунды бездействия
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const sendIframeCommand = (command: string, args: unknown[] = []) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args }),
      "*",
    );
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      sendIframeCommand("pauseVideo");
      setIsPlaying(false);
    } else {
      sendIframeCommand("playVideo");
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  const handleToggleMute = () => {
    if (isMuted) {
      sendIframeCommand("unMute");
      setIsMuted(false);
    } else {
      sendIframeCommand("mute");
      setIsMuted(true);
    }
    resetControlsTimer();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // URL официального встраиваемого плеера YouTube
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `https://www.youtube.com/embed/${currentEpisode.videoId}?autoplay=1&mute=${
    isMuted ? 1 : 0
  }&playsinline=1&rel=0&modestbranding=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`;

  const directYoutubeUrl = `https://www.youtube.com/watch?v=${currentEpisode.videoId}`;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      className="relative h-full w-full bg-black overflow-hidden select-none flex items-center justify-center"
    >
      {/* YouTube IFrame Embed Player */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={currentEpisode.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        onLoad={() => setIsLoading(false)}
        className="h-full w-full object-contain pointer-events-auto"
      />

      {/* Индикатор загрузки */}
      {isLoading && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none backdrop-blur-2xs transition-opacity">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Загрузка серии...</span>
          </div>
        </div>
      )}

      {/* Ошибка видео / Ограничение правообладателя */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center z-30">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
          <h4 className="text-base font-bold text-white mb-1">Серия временно недоступна</h4>
          <p className="text-xs text-white/70 max-w-xs mb-5">
            Источник ограничил внешнее воспроизведение этой серии. Вы можете перейти к следующей серии без нарушения последовательности.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {hasNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg active:scale-95 transition-all"
              >
                Следующая серия
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <a
              href={directYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-xs font-semibold text-white shadow-sm active:scale-95 transition-all"
            >
              Смотреть на YouTube
            </a>
            {!hasNextEpisode && (
              <button
                type="button"
                onClick={onOpenEpisodePicker}
                className="rounded-2xl bg-muted px-4 py-2 text-xs font-bold text-foreground"
              >
                Выбрать другую серию
              </button>
            )}
          </div>
        </div>
      )}

      {/* Верхний плавающий бар */}
      <div
        className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="min-w-0 pr-3 pointer-events-auto">
          <h2 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md">
            {dramaTitle}
          </h2>
          <p className="text-[11px] text-white/80 font-medium truncate drop-shadow-sm">
            Серия {currentEpisode.episodeNumber} из {totalEpisodes}: {currentEpisode.title}
          </p>
        </div>

        {/* Кнопка вызова списка серий */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEpisodePicker();
          }}
          className="pointer-events-auto shrink-0 flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/25 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md shadow-md active:scale-95 transition-all"
        >
          <ListVideo className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Серии</span>
        </button>
      </div>

      {/* Нижний плавающий бар быстрого управления */}
      <div
        className={`absolute bottom-2 inset-x-2 z-20 flex items-center justify-between p-2 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md pointer-events-none transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          {hasPrevEpisode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrevEpisode();
              }}
              className="p-1.5 text-white/80 hover:text-white active:scale-90 transition-all"
              aria-label="Предыдущая серия"
            >
              <SkipBack className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePlay();
            }}
            className="p-1.5 text-white hover:text-primary active:scale-90 transition-all"
            aria-label={isPlaying ? "Пауза" : "Воспроизведение"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          {hasNextEpisode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextEpisode();
              }}
              className="p-1.5 text-white/80 hover:text-white active:scale-90 transition-all"
              aria-label="Следующая серия"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMute();
            }}
            className="p-1.5 text-white/80 hover:text-white active:scale-90 transition-all"
            aria-label={isMuted ? "Включить звук" : "Выключить звук"}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {hasNextEpisode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextEpisode();
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-bold shadow-sm active:scale-95 transition-all"
            >
              След. серия
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFullscreen();
            }}
            className="p-1.5 text-white/80 hover:text-white active:scale-90 transition-all"
            aria-label="Полноэкранный режим"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
