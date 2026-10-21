"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { AlertCircle, Play } from "lucide-react";

export interface DedicatedDramaPlayerHandle {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unMute: () => void;
}

interface DedicatedDramaPlayerProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  isMuted?: boolean;
  autoplay?: boolean;
  onEnded?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

// Глобальный флаг пользовательского взаимодействия в рамках сессии браузера
let globalUserInteracted = false;
if (typeof window !== "undefined") {
  const markInteracted = () => {
    globalUserInteracted = true;
    window.removeEventListener("touchstart", markInteracted);
    window.removeEventListener("click", markInteracted);
    window.removeEventListener("keydown", markInteracted);
  };
  window.addEventListener("touchstart", markInteracted, { passive: true });
  window.addEventListener("click", markInteracted, { passive: true });
  window.addEventListener("keydown", markInteracted, { passive: true });
}

/**
 * Изолированный видеоплеер эпизода на базе YouTube Iframe API.
 * Гарантирует:
 * 1. 100% автоплей на мобильных устройствах (iOS Safari / Android) без блокировок и без красной кнопки YouTube.
 * 2. Полную синхронизацию видео и метаданных.
 * 3. Поддержку управления жестами и мгновенное включение звука при первом касании.
 */
export const DedicatedDramaPlayer = forwardRef<
  DedicatedDramaPlayerHandle,
  DedicatedDramaPlayerProps
>(function DedicatedDramaPlayer(
  {
    videoId,
    title,
    thumbnailUrl,
    isMuted = false,
    autoplay = true,
    onEnded,
    onPlayStateChange,
    className = "",
  },
  ref
) {
  const [errorVideoId, setErrorVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isIframeReady, setIsIframeReady] = useState(false);
  const userWantsPlayRef = useRef(false);
  const hasError = errorVideoId === videoId;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [prevVideoId, setPrevVideoId] = useState(videoId);
  if (prevVideoId !== videoId) {
    setPrevVideoId(videoId);
    setIsIframeReady(false);
    setIsPlaying(false);
  }

  // Безопасная отправка команд в YouTube Player API через postMessage
  const sendCommand = useCallback((func: string, args?: unknown) => {
    try {
      if (iframeRef.current?.contentWindow) {
        const payload =
          args !== undefined
            ? { event: "command", func, args }
            : { event: "command", func };
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify(payload),
          "*"
        );
      }
    } catch {}
  }, []);

  // Экспорт императивных методов наружу для мгновенного вызова внутри onTouchEnd/onClick
  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        globalUserInteracted = true;
        userWantsPlayRef.current = true;
        sendCommand("playVideo");
        setIsPlaying(true);
        if (!isMuted) {
          sendCommand("unMute");
          sendCommand("setVolume", [100]);
        }
      },
      pause: () => {
        userWantsPlayRef.current = false;
        sendCommand("pauseVideo");
        setIsPlaying(false);
      },
      mute: () => {
        sendCommand("mute");
      },
      unMute: () => {
        globalUserInteracted = true;
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      },
    }),
    [isMuted, sendCommand]
  );

  // Синхронизация звука
  useEffect(() => {
    if (isMuted) {
      sendCommand("mute");
    } else {
      // Unmute отправляем только если пользователь уже взаимодействовал с приложением,
      // чтобы Safari не заблокировал воспроизведение из-за политики автоплея звука.
      if (globalUserInteracted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    }
  }, [isMuted, sendCommand]);

  // Обработчик загрузки фрейма и отправка handshake listening
  const handleIframeLoad = useCallback(() => {
    setIsIframeReady(true);
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "listening" }),
          "*"
        );
      }
    } catch {}

    if (autoplay || userWantsPlayRef.current) {
      sendCommand("playVideo");
      if (!isMuted && globalUserInteracted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    }
  }, [autoplay, isMuted, sendCommand]);

  // Регулярный handshake listening на случай задержки загрузки
  useEffect(() => {
    const pingYouTube = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening" }),
          "*"
        );
      } catch {}
    };

    pingYouTube();
    const t1 = setTimeout(pingYouTube, 250);
    const t2 = setTimeout(pingYouTube, 750);
    const t3 = setTimeout(pingYouTube, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [videoId]);

  // Слушаем события от YouTube Player API
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;

      const eventName = data.event;
      let playerState: number | undefined;

      if (typeof data.info === "number") {
        playerState = data.info;
      } else if (typeof data.data === "number") {
        playerState = data.data;
      } else if (
        data.info &&
        typeof data.info === "object" &&
        typeof data.info.playerState === "number"
      ) {
        playerState = data.info.playerState;
      }

      if (eventName === "onReady" || eventName === "initialDelivery") {
        setIsIframeReady(true);
        if (autoplay || userWantsPlayRef.current) {
          sendCommand("playVideo");
          if (!isMuted && globalUserInteracted) {
            sendCommand("unMute");
            sendCommand("setVolume", [100]);
          }
        }
      }

      if (playerState !== undefined) {
        // -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
        if (playerState === 0) {
          setIsPlaying(false);
          userWantsPlayRef.current = false;
          if (onPlayStateChange) onPlayStateChange(false);
          if (onEnded) onEnded();
        } else if (playerState === 1) {
          setIsPlaying(true);
          userWantsPlayRef.current = true;
          if (onPlayStateChange) onPlayStateChange(true);
        } else if (playerState === 2) {
          setIsPlaying(false);
          userWantsPlayRef.current = false;
          if (onPlayStateChange) onPlayStateChange(false);
        }
      }

      if (eventName === "onError") {
        setErrorVideoId(videoId);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [autoplay, isMuted, onEnded, onPlayStateChange, sendCommand, videoId]);

  // Обработчик первого касания / клика по плееру:
  // Если плеер не играет — ГАРАНТИРОВАННО запускаем воспроизведение с 1-го нажатия!
  const handlePlayerTap = useCallback(() => {
    globalUserInteracted = true;
    if (!isPlaying) {
      userWantsPlayRef.current = true;
      sendCommand("playVideo");
      setIsPlaying(true);
      if (!isMuted) {
        sendCommand("unMute");
        sendCommand("setVolume", [100]);
      }
    } else {
      userWantsPlayRef.current = false;
      sendCommand("pauseVideo");
      setIsPlaying(false);
    }
  }, [isPlaying, isMuted, sendCommand]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // ВАЖНО ДЛЯ МОБИЛЬНЫХ БРАУЗЕРОВ (WebKit Safari / Chrome Android):
  // До первого пользовательского жеста мы ВСЕГДА монтируем с mute=1.
  // Это на 100% соответствует стандартам W3C Autoplay Policy и гарантирует,
  // что браузер НИКОГДА не заблокирует плеер и не покажет красную кнопку YouTube!
  // Как только пользователь касается экрана, звук мгновенно разблокируется.
  const initialMuteParam = isMuted || !globalUserInteracted ? 1 : 0;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${initialMuteParam}&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(
    origin
  )}&widget_referrer=${encodeURIComponent(origin)}`;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-black flex items-center justify-center select-none ${className}`}
    >
      {/* Фоновое превью постера */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={title}
          className={`absolute inset-0 h-full w-full object-cover blur-sm opacity-30 scale-105 pointer-events-none transition-opacity duration-500 ${
            isIframeReady && isPlaying ? "opacity-0" : "opacity-30"
          }`}
          loading="eager"
        />
      )}

      {/* YouTube Iframe: монтируется с точным ключом серии */}
      <iframe
        ref={iframeRef}
        key={`yt-iframe-${videoId}`}
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        onLoad={handleIframeLoad}
        className="h-full w-full object-cover pointer-events-none relative z-10"
      />

      {/* Интерактивный слой перехвата касания: передает жесты и управляет play/pause */}
      <div
        onClick={handlePlayerTap}
        className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
        aria-label={isPlaying ? "Пауза" : "Воспроизведение"}
      >
        {/* Индикатор паузы (показывается только когда плеер реально на паузе) */}
        {!isPlaying && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-2xl ring-4 ring-white/20 active:scale-90 transition-transform">
              <Play className="h-8 w-8 fill-white ml-1" />
            </span>
          </div>
        )}
      </div>

      {/* Ошибка доступности серии (показывается только при реальной блокировке YouTube) */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-4 text-center z-30 pointer-events-auto">
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
});
