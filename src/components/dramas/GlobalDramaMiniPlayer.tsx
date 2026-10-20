"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  ExternalLink,
  ZoomIn,
  ZoomOut,
  GripHorizontal,
} from "lucide-react";
import { useDramaPlayer } from "@/context/DramaPlayerContext";

const DedicatedDramaPlayer = dynamic(
  () => import("./DedicatedDramaPlayer").then((m) => m.DedicatedDramaPlayer),
  { ssr: false }
);

/**
 * Глобальный плавающий мини-плеер ("В окне" / Picture-in-Picture).
 * СТРОГО ВЕРТИКАЛЬНЫЙ ФОРМАТ (9:16).
 *
 * ФУНКЦИОНАЛ:
 * 1. Перемещение одним пальцем по всему экрану (Drag-to-move).
 * 2. Изменение размера двумя пальцами (Pinch-to-zoom) + кнопки масштабирования (+ / -).
 * 3. Режим нативного плавающего окна ОС поверх всех программ (Document Picture-in-Picture).
 * 4. Умный трекер просмотренного, переключение звука и переход между сериями.
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
  const [isExternalPiP, setIsExternalPiP] = useState(false);
  const [supportsDocPiP] = useState(() => {
    if (typeof window === "undefined") return false;
    return "documentPictureInPicture" in window;
  });
  const [pinchFeedback, setPinchFeedback] = useState<number | null>(null);

  // Координаты окна (null = правый нижний угол по умолчанию)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // Ширина окна (по умолчанию ~190-210px с соотношением 9:16)
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 200;
    return Math.min(220, Math.max(160, Math.round(window.innerWidth * 0.52)));
  });

  const height = isMinimized ? 56 : Math.round(width * (16 / 9));

  // Ссылки на touch/pointer состояние для перетаскивания и щипка двумя пальцами
  const isDraggingRef = useRef(false);
  const isPinchingRef = useRef(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  }>({ startX: 0, startY: 0, initX: 0, initY: 0 });

  const pinchStartRef = useRef<{
    initDist: number;
    initWidth: number;
  }>({ initDist: 0, initWidth: 200 });

  // Вспомогательная функция ограничения координат экраном
  const clampPosition = useCallback(
    (x: number, y: number, curW: number, curH: number) => {
      const maxX = Math.max(8, window.innerWidth - curW - 8);
      const maxY = Math.max(12, window.innerHeight - curH - 74);
      return {
        x: Math.max(8, Math.min(maxX, x)),
        y: Math.max(12, Math.min(maxY, y)),
      };
    },
    []
  );

  // Инициализация начальной позиции в правом нижнем углу над таб-баром
  const getEffectivePosition = useCallback(() => {
    if (position) return position;
    if (typeof window === "undefined") return { x: 16, y: 100 };
    return {
      x: window.innerWidth - width - 12,
      y: window.innerHeight - height - 80,
    };
  }, [position, width, height]);

  // ================= 1 ПАЛЕЦ (ПЕРЕМЕЩЕНИЕ) И 2 ПАЛЬЦА (МАСШТАБИРОВАНИЕ) =================
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 пальца: Жест увеличения/уменьшения (Pinch-to-zoom)
      isDraggingRef.current = false;
      isPinchingRef.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartRef.current = {
        initDist: dist,
        initWidth: width,
      };
    } else if (e.touches.length === 1) {
      // 1 палец: Перемещение по экрану (Drag-to-move)
      isPinchingRef.current = false;
      isDraggingRef.current = true;
      const t = e.touches[0];
      const cur = getEffectivePosition();
      dragStartRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        initX: cur.x,
        initY: cur.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinchingRef.current && e.touches.length === 2) {
      // Масштабирование двумя пальцами
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (pinchStartRef.current.initDist > 0) {
        const scale = dist / pinchStartRef.current.initDist;
        const minW = 150;
        const maxW = Math.min(360, window.innerWidth - 20);
        const newW = Math.round(
          Math.max(minW, Math.min(maxW, pinchStartRef.current.initWidth * scale))
        );
        setWidth(newW);
        setPinchFeedback(Math.round((newW / 200) * 100));
      }
    } else if (isDraggingRef.current && e.touches.length === 1) {
      // Перемещение одним пальцем
      const t = e.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      const newX = dragStartRef.current.initX + dx;
      const newY = dragStartRef.current.initY + dy;
      const clamped = clampPosition(newX, newY, width, height);
      setPosition(clamped);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    isPinchingRef.current = false;
    setTimeout(() => setPinchFeedback(null), 600);
  };

  // ================= Мышь (Drag на ПК) =================
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // Touch обрабатывается touch-событиями
    // Перетаскивание кликом мыши по верхней строке
    isDraggingRef.current = true;
    const cur = getEffectivePosition();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: cur.x,
      initY: cur.y,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvt.clientX - dragStartRef.current.startX;
      const dy = moveEvt.clientY - dragStartRef.current.startY;
      const newX = dragStartRef.current.initX + dx;
      const newY = dragStartRef.current.initY + dy;
      setPosition(clampPosition(newX, newY, width, height));
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Кнопки быстрого масштабирования
  const handleZoom = (delta: number) => {
    setWidth((prev) => {
      const minW = 150;
      const maxW = Math.min(360, window.innerWidth - 20);
      const next = Math.max(minW, Math.min(maxW, prev + delta));
      setPinchFeedback(Math.round((next / 200) * 100));
      setTimeout(() => setPinchFeedback(null), 800);
      return next;
    });
  };

  // ================= НАСТОЯЩЕЕ ПЛАВАЮЩЕЕ ОКНО ОС (Document PiP) =================
  const openNativeOSWindow = async () => {
    if (!miniItem) return;
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      try {
        const pipWindow = await (window as unknown as {
          documentPictureInPicture: {
            requestWindow: (opt: { width: number; height: number }) => Promise<Window>;
          };
        }).documentPictureInPicture.requestWindow({
          width: 320,
          height: 560,
        });

        // Копируем стили из родительского документа
        Array.from(document.styleSheets).forEach((styleSheet) => {
          try {
            const rules = Array.from(styleSheet.cssRules)
              .map((r) => r.cssText)
              .join("");
            const style = document.createElement("style");
            style.textContent = rules;
            pipWindow.document.head.appendChild(style);
          } catch {
            if (styleSheet.href) {
              const link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        const container = pipWindow.document.createElement("div");
        container.style.cssText =
          "width:100vw;height:100vh;background:#000;margin:0;padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;";

        const iframe = pipWindow.document.createElement("iframe");
        const origin = window.location.origin;
        iframe.src = `https://www.youtube.com/embed/${miniItem.episode.videoId}?autoplay=1&mute=${
          isMiniMuted ? 1 : 0
        }&playsinline=1&controls=1&enablejsapi=1&origin=${encodeURIComponent(
          origin
        )}`;
        iframe.style.cssText = "width:100%;height:100%;border:none;object-fit:cover;";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";

        container.appendChild(iframe);
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.appendChild(container);

        setIsExternalPiP(true);

        pipWindow.addEventListener("pagehide", () => {
          setIsExternalPiP(false);
        });
      } catch (err) {
        console.warn("Document Picture-in-Picture error:", err);
      }
    }
  };

  if (!isMiniPlayerOpen || !miniItem) return null;

  const watched = isWatched(miniItem.drama.id, miniItem.episodeNumber);
  const curPos = getEffectivePosition();

  return (
    <aside
      aria-label="Вертикальный плавающий плеер сериала"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(${curPos.x}px, ${curPos.y}px, 0)`,
        touchAction: "none",
      }}
      className={`fixed top-0 left-0 z-50 transition-transform duration-75 ease-out shadow-2xl overflow-hidden border border-white/25 bg-black/95 backdrop-blur-2xl select-none rounded-3xl ${
        isMinimized ? "rounded-2xl" : ""
      }`}
    >
      {/* Верхняя строка управления (перетаскивание + размер + PiP) */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute top-0 inset-x-0 h-10 z-30 bg-gradient-to-b from-black/95 via-black/60 to-transparent flex items-center justify-between px-2 text-white cursor-grab active:cursor-grabbing pointer-events-auto"
      >
        <div className="flex items-center gap-1 overflow-hidden pointer-events-none">
          <GripHorizontal className="h-3.5 w-3.5 text-white/60 shrink-0" />
          <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
          <span className="text-[11px] font-bold truncate max-w-[70px] sm:max-w-[100px]">
            {miniItem.drama.title}
          </span>
          <span className="rounded-full bg-primary/90 px-1 py-0.2 text-[8px] font-black shrink-0">
            {miniItem.episodeNumber}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Кнопка "Окно поверх программ ОС" */}
          {supportsDocPiP && (
            <button
              type="button"
              onClick={openNativeOSWindow}
              className={`p-1 rounded-full transition-all active:scale-90 ${
                isExternalPiP
                  ? "bg-violet-600 text-white"
                  : "text-white/80 hover:text-white hover:bg-white/20"
              }`}
              title="Открыть плавающее окно поверх всех программ ОС"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}

          {/* Быстрые кнопки масштабирования (+ / -) */}
          {!isMinimized && (
            <>
              <button
                type="button"
                onClick={() => handleZoom(-30)}
                className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/70 hover:text-white"
                title="Уменьшить размер"
              >
                <ZoomOut className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(30)}
                className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/70 hover:text-white"
                title="Увеличить размер"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </>
          )}

          {/* Свернуть / Развернуть */}
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/80 hover:text-white"
            title={isMinimized ? "Развернуть" : "Свернуть"}
          >
            {isMinimized ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Полноэкранный переход в /dramas */}
          <Link
            href="/dramas"
            className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all text-white/80 hover:text-white"
            title="Открыть на весь экран"
          >
            <Maximize2 className="h-3 w-3" />
          </Link>

          {/* Закрыть */}
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

      {/* Индикатор масштаба при жесте pinch */}
      {pinchFeedback !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <span className="rounded-full bg-black/80 border border-white/30 px-3 py-1 text-xs font-black text-white shadow-2xl backdrop-blur-md">
            Масштаб: {pinchFeedback}%
          </span>
        </div>
      )}

      {/* Контент вертикального мини-плеера (9:16) */}
      {!isMinimized ? (
        <div className="relative h-full w-full flex flex-col justify-between bg-black">
          {/* Видеоплеер */}
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
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-20" />

          {/* Нижняя панель управления */}
          <div className="absolute bottom-1.5 inset-x-1.5 z-30 flex items-center justify-between text-white pointer-events-auto">
            {/* Кнопки переключения серий и звука */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={playPrevInMini}
                className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                title="Предыдущая серия"
              >
                <SkipBack className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={playNextInMini}
                className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                title="Следующая серия"
              >
                <SkipForward className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={toggleMiniMute}
                className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/90 hover:text-white backdrop-blur-md active:scale-90 transition-all"
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
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-md border transition-all active:scale-95 ${
                watched
                  ? "bg-emerald-600/90 border-emerald-400/50 text-white shadow-sm"
                  : "bg-black/60 border-white/20 text-white/80 hover:text-white"
              }`}
              title={watched ? "Отмечено как просмотрено" : "Отметить просмотренным"}
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>{watched ? "Готово" : "Отметить"}</span>
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
              {isMiniMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
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
