"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
 * Единый персистентный видеоплеер для AI-сериалов.
 * Поддерживает полноэкранный режим и вертикальный режим мини-окна (9:16).
 * Не пересоздает iframe при переключении серий, а использует loadVideoById,
 * что гарантирует АВТОМАТИЧЕСКИЙ ЗАПУСК без зависаний и необходимости ручного клика.
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
  const prevVideoIdRef = useRef(videoId);

  // Безопасная отправка команд в YouTube Player API через postMessage
  const sendCommand = useCallback((func: string, args?: unknown) => {
    try {
      if (iframeRef.current?.contentWindow) {
        const payload = args !== undefined
          ? { event: "command", func, args }
          : { event: "command", func };
        iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), "*");
      }
    } catch {
      // Игнорируем редкие ограничения междоменных сообщений
    }
  }, []);

  // Синхронизация звука при переключении props.isMuted
  useEffect(() => {
    if (isMuted) {
      sendCommand("mute");
    } else {
      sendCommand("unMute");
      sendCommand("setVolume", [100]);
    }
  }, [isMuted, sendCommand]);

  // ПЕРЕКЛЮЧЕНИЕ СЕРИЙ БЕЗ ПЕРЕСОЗДАНИЯ IFRAME:
  // При смене серии используем loadVideoById в уже запущенном плеере!
  // Это сохраняет пользовательскую активацию и воспроизводит видео мгновенно без блокировок браузера.
  useEffect(() => {
    if (prevVideoIdRef.current !== videoId) {
      prevVideoIdRef.current = videoId;
      setErrorVideoId(null);

      // Загружаем и запускаем новую серию через API
      sendCommand("loadVideoById", [videoId, 0]);
      if (autoplay) {
        sendCommand("playVideo");
        if (!isMuted) {
          sendCommand("unMute");
          sendCommand("setVolume", [100]);
        }
      }
    }
  }, [videoId, autoplay, isMuted, sendCommand]);

  // Обработчик загрузки iframe: инициализирует API и мгновенно активирует автоплей
  const handleIframeLoad = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening" }),
          "*"
        );
      }
    } catch {}

    if (autoplay) {
      sendCommand("playVideo");
      if (!isMuted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      } else {
        sendCommand("mute");
      }
    }
  }, [autoplay, isMuted, sendCommand]);

  // Тройное подтверждение автоплея на мобильных устройствах
  useEffect(() => {
    if (!autoplay) return;
    const t1 = setTimeout(() => {
      sendCommand("playVideo");
      if (!isMuted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    }, 150);

    const t2 = setTimeout(() => {
      sendCommand("playVideo");
      if (!isMuted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    }, 450);

    const t3 = setTimeout(() => {
      sendCommand("playVideo");
      if (!isMuted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    }, 850);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [autoplay, isMuted, sendCommand, videoId]);

  // Слушаем события от YouTube Player API
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);

        // Когда плеер готов к воспроизведению
        if (parsed.event === "onReady" || parsed.event === "initialDelivery") {
          if (autoplay) {
            sendCommand("playVideo");
            if (!isMuted) {
              sendCommand("unMute");
              sendCommand("setVolume", [100]);
            }
          }
        } else if (parsed.event === "onStateChange") {
          // 0 = ENDED (серия закончилась -> автопереход к следующей)
          if (parsed.info === 0 || parsed.data === 0) {
            if (onEnded) onEnded();
          } else if (parsed.info === 2 || parsed.data === 2) {
            // Если плеер встал на паузу при автоплее на мобильном устройстве
            if (autoplay) {
              sendCommand("playVideo");
            }
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
  }, [autoplay, isMuted, onEnded, sendCommand, videoId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // НАЧАЛЬНЫЙ МОНТАЖ IFRAME:
  // Начальный запрос содержит mute=1, что гарантирует 100% обход строгой блокировки
  // autoplay в мобильных браузерах (Safari iOS, Chrome Android).
  // Сразу после старта unMute включает звук без вызова всплывающего оверлея YouTube.
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(
    origin
  )}&widget_referrer=${encodeURIComponent(origin)}`;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-black flex items-center justify-center ${className}`}
    >
      {/* Фоновое превью постера */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover blur-sm opacity-25 scale-105 pointer-events-none"
        />
      )}

      {/* Сам YouTube Iframe: монтируется ОДИН раз со стабильным ключом */}
      <iframe
        ref={iframeRef}
        key="yt-dedicated-singleton-player"
        src={embedUrl}
        title={title}
        onLoad={handleIframeLoad}
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
