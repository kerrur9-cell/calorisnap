"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

interface DedicatedDramaPlayerProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  isMuted?: boolean;
  autoplay?: boolean;
  onEnded?: () => void;
  className?: string;
}

/**
 * Изолированный выделенный видеоплеер для китайских ИИ-сериалов.
 * Поддерживает полноэкранный режим и вертикальный режим мини-окна (9:16).
 * Обеспечивает мгновенный запуск без зависающих оверлеев и бесконечной загрузки.
 */
export function DedicatedDramaPlayer({
  videoId,
  title,
  thumbnailUrl,
  isMuted = false,
  autoplay = true,
  onEnded,
  className = "",
}: DedicatedDramaPlayerProps) {
  const [errorVideoId, setErrorVideoId] = useState<string | null>(null);
  const hasError = errorVideoId === videoId;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Слушаем события от YouTube Player API для автоперехода
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === "onStateChange") {
          // 0 = ENDED (серия закончилась -> автопереход к следующей)
          if (parsed.info === 0 || parsed.data === 0) {
            if (onEnded) onEnded();
          }
        } else if (parsed.event === "onError") {
          setErrorVideoId(videoId);
        }
      } catch {
        // Игнорируем не-JSON сообщения
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEnded, videoId]);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${
    autoplay ? 1 : 0
  }&mute=${isMuted ? 1 : 0}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black flex items-center justify-center ${className}`}>
      {/* Фоновое превью постера */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover blur-sm opacity-25 scale-105 pointer-events-none"
        />
      )}

      {/* Сам YouTube Iframe: монтируется и воспроизводится напрямую без блокирующих оверлеев */}
      <iframe
        ref={iframeRef}
        key={`yt-player-${videoId}`}
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        className="h-full w-full object-cover pointer-events-auto relative z-10"
      />

      {/* Ошибка доступности серии (показывается только при реальной ошибке плеера) */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-4 text-center z-20">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
          <h4 className="text-xs font-bold text-white mb-1">
            Серия временно недоступна
          </h4>
          <p className="text-[10px] text-white/70 max-w-xs mb-3">
            Ограничение внешнего плеера YouTube.
          </p>
          <div className="flex flex-col gap-1.5">
            {onEnded && (
              <button
                type="button"
                onClick={onEnded}
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-md active:scale-95"
              >
                Следующая серия
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary underline"
            >
              Смотреть на YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
