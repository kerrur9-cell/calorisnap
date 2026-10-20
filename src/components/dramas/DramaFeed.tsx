"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Star,
  ListVideo,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Share2,
  Film,
  Check,
  AlertCircle,
  Loader2,
  Minimize2,
  Shuffle,
  CheckCircle2,
} from "lucide-react";
import type { Drama, DramaEpisode } from "@/lib/dramas/types";
import { EpisodePickerDrawer } from "./EpisodePickerDrawer";
import { useSaveDramaProgress, useToggleFavorite } from "@/hooks/useDramas";
import { useDramaPlayer } from "@/context/DramaPlayerContext";

export interface FeedItem {
  key: string;
  drama: Drama;
  episode: DramaEpisode;
  episodeNumber: number;
  totalEpisodesInDrama: number;
}

interface DramaFeedProps {
  initialDramas: Drama[];
  initialDramaId?: string;
  initialEpisodeNumber?: number;
}

export function DramaFeed({
  initialDramas,
  initialDramaId,
  initialEpisodeNumber,
}: DramaFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const saveProgress = useSaveDramaProgress();
  const toggleFavorite = useToggleFavorite();

  const {
    isWatched,
    markWatched,
    isMiniPlayerOpen,
    openMiniPlayer,
    shuffleDramas,
  } = useDramaPlayer();

  // 1. Стабильная последовательность: перемешивается ровно ОДИН раз при загрузке или по кнопке
  const [dramasSequence, setDramasSequence] = useState<Drama[]>(() =>
    shuffleDramas(initialDramas)
  );

  const prevLenRef = useRef(initialDramas.length);
  useEffect(() => {
    // Если список впервые загрузился из сети (был пуст, стал с данными)
    if (prevLenRef.current === 0 && initialDramas.length > 0) {
      setDramasSequence(shuffleDramas(initialDramas));
    }
    prevLenRef.current = initialDramas.length;
  }, [initialDramas, shuffleDramas]);

  // Ручное перемешивание ленты ("🔀 Перемешать")
  const handleShuffleClick = useCallback(() => {
    const next = shuffleDramas(initialDramas);
    setDramasSequence(next);
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [initialDramas, shuffleDramas]);

  // Разворачиваем сериалы в единую последовательную ленту эпизодов
  // Серии внутри сериала идут строго 1 -> 2 -> ... -> N
  const feedItems: FeedItem[] = useMemo(() => {
    const list: FeedItem[] = [];
    for (const drama of dramasSequence) {
      const eps = drama.episodes || [];
      if (eps.length === 0) continue;

      const sortedEps = [...eps].sort((a, b) => a.episodeNumber - b.episodeNumber);
      for (const ep of sortedEps) {
        list.push({
          key: `${drama.id}_ep_${ep.episodeNumber}`,
          drama,
          episode: ep,
          episodeNumber: ep.episodeNumber,
          totalEpisodesInDrama: sortedEps.length,
        });
      }
    }
    return list;
  }, [dramasSequence]);

  // Вычисляем стартовый индекс при открытии (например, выбранный сериал из каталога)
  useEffect(() => {
    if (feedItems.length === 0) return;

    let targetIdx = 0;
    if (initialDramaId) {
      const foundIdx = feedItems.findIndex((it) => {
        if (it.drama.id !== initialDramaId) return false;
        if (initialEpisodeNumber) {
          return it.episodeNumber === initialEpisodeNumber;
        }
        return true;
      });
      if (foundIdx >= 0) targetIdx = foundIdx;
    }

    setActiveIndex(targetIdx);

    if (containerRef.current && targetIdx > 0) {
      const targetElem = itemRefs.current[targetIdx];
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: "instant" });
      }
    }
  }, [initialDramaId, initialEpisodeNumber, feedItems]);

  // Следим за скроллом и безопасно переключаем активную серию
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight === 0) return;

    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex >= 0 && newIndex < feedItems.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      if (showSwipeHint) setShowSwipeHint(false);

      // Сохраняем прогресс с дебаунсом, чтобы не спамить
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        const activeItem = feedItems[newIndex];
        if (activeItem) {
          saveProgress.mutate({
            dramaId: activeItem.drama.id,
            episodeId: activeItem.episode.id,
            episodeNumber: activeItem.episodeNumber,
          });
        }
      }, 500);
    }
  }, [activeIndex, feedItems, saveProgress, showSwipeHint]);

  // Прокрутка к следующему видео
  const scrollToNext = useCallback(() => {
    if (activeIndex < feedItems.length - 1) {
      const nextIdx = activeIndex + 1;
      itemRefs.current[nextIdx]?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeIndex, feedItems.length]);

  // Прокрутка к предыдущему видео
  const scrollToPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      itemRefs.current[prevIdx]?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeIndex]);

  // Управление клавишами на ПК
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        scrollToNext();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrollToNext, scrollToPrev]);

  // Поделиться ссылкой
  const handleShare = (item: FeedItem) => {
    const url = `${window.location.origin}/dramas/${item.drama.id}`;
    if (navigator.share) {
      navigator.share({
        title: item.drama.title,
        text: `Смотри китайский AI-сериал "${item.drama.title}" в CaloriSnap!`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const activeItem = feedItems[activeIndex];

  if (feedItems.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-6 text-center text-muted-foreground">
        <Film className="h-10 w-10 mb-3 opacity-60" />
        <p className="text-sm font-bold text-foreground">Сериалы не найдены</p>
        <p className="text-xs mt-1">Попробуйте сбросить фильтры поиска</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100dvh-12.5rem)] min-h-[480px] max-h-[820px] rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 select-none">
      {/* Кнопка случайного перемешивания вверху слева */}
      <div className="absolute top-3 left-3 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={handleShuffleClick}
          className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md hover:bg-black/80 active:scale-95 transition-all"
          title="Случайно перемешать порядок сборников"
        >
          <Shuffle className="h-3 w-3 text-violet-400" />
          <span>Перемешать</span>
        </button>
      </div>

      {/* Вертикальный TikTok-контейнер со строгим scroll-snap */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth touch-pan-y overscroll-contain scrollbar-none"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {feedItems.map((item, idx) => {
          const isActive = idx === activeIndex;
          // СТРОГОЕ ПРАВИЛО: ровно ОДНО видео монтируется в DOM. Никаких наложений звука!
          const shouldMountVideo = isActive && !isMiniPlayerOpen;
          const watched = isWatched(item.drama.id, item.episodeNumber);

          return (
            <div
              key={item.key}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className="relative h-full w-full snap-start snap-always shrink-0 overflow-hidden bg-black flex items-center justify-center"
            >
              {/* Фоновое превью / Постер */}
              <img
                src={item.episode.thumbnailUrl || item.drama.coverUrl}
                alt={item.episode.title}
                className="absolute inset-0 h-full w-full object-cover blur-md opacity-35 scale-105 pointer-events-none"
              />

              {/* Видео-плеер или карточка ожидания */}
              {shouldMountVideo ? (
                <TikTokEpisodePlayer
                  key={`player-${item.episode.videoId}`}
                  item={item}
                  isMuted={isMuted}
                  onEnded={() => {
                    markWatched(item.drama.id, item.episodeNumber, true);
                    scrollToNext();
                  }}
                />
              ) : (
                <div className="relative h-full w-full flex items-center justify-center">
                  <img
                    src={item.episode.thumbnailUrl || item.drama.coverUrl}
                    alt={item.episode.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/80 text-white shadow-xl">
                      <Play className="h-6 w-6 fill-white ml-0.5" />
                    </span>
                    {isMiniPlayerOpen && isActive && (
                      <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-violet-300 border border-violet-500/30">
                        Воспроизводится в окне
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Затемняющий градиент сверху и снизу в стиле TikTok */}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

              {/* Правая плавающая панель кнопок (TikTok Style) */}
              <div className="absolute right-3 bottom-8 z-30 flex flex-col items-center gap-3 pointer-events-auto">
                {/* Аватар / Постер сериала */}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="relative group active:scale-90 transition-transform"
                  aria-label="Все серии"
                >
                  <div className="h-10 w-10 rounded-full p-0.5 bg-gradient-to-tr from-violet-600 via-primary to-fuchsia-500 shadow-xl">
                    <img
                      src={item.drama.coverUrl}
                      alt={item.drama.title}
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-black text-primary-foreground shadow-sm">
                    {item.episodeNumber}/{item.totalEpisodesInDrama}
                  </span>
                </button>

                {/* Кнопка "В окне" (Floating Picture-in-Picture Mini-Player) */}
                <button
                  type="button"
                  onClick={() => openMiniPlayer(item)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label="Смотреть в окне"
                  title="Смотреть в окне и пользоваться сайтом"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/80 border border-violet-400/50 text-white backdrop-blur-md shadow-lg hover:bg-violet-600">
                    <Minimize2 className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                    В окне
                  </span>
                </button>

                {/* Умный трекер: Отметка просмотренного */}
                <button
                  type="button"
                  onClick={() => markWatched(item.drama.id, item.episodeNumber, !watched)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label={watched ? "Отмечено как просмотрено" : "Отметить просмотренным"}
                  title={watched ? "Снять отметку" : "Отметить как просмотренное"}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md shadow-lg transition-all ${
                      watched
                        ? "bg-emerald-600/90 border-emerald-400/60 text-white"
                        : "bg-black/60 border-white/20 text-white/70 hover:text-white"
                    }`}
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[9px] font-bold text-white drop-shadow-md">
                    {watched ? "Просмотрено" : "Отметить"}
                  </span>
                </button>

                {/* Кнопка "В закладки / Избранное" */}
                <button
                  type="button"
                  onClick={() => toggleFavorite.mutate(item.drama.id)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label={item.drama.isFavorite ? "В избранном" : "В закладки"}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg hover:bg-black/80">
                    <Star
                      className={`h-4.5 w-4.5 transition-colors ${
                        item.drama.isFavorite ? "fill-amber-400 text-amber-400" : "text-white"
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                    {item.drama.isFavorite ? "В избранном" : "Закладка"}
                  </span>
                </button>

                {/* Кнопка выбора серий */}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label="Список серий"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg hover:bg-black/80">
                    <ListVideo className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                    Серии
                  </span>
                </button>

                {/* Переключатель звука */}
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg hover:bg-black/80">
                    {isMuted ? (
                      <VolumeX className="h-4.5 w-4.5 text-amber-400" />
                    ) : (
                      <Volume2 className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                    {isMuted ? "Без звука" : "Звук"}
                  </span>
                </button>

                {/* Кнопка поделиться */}
                <button
                  type="button"
                  onClick={() => handleShare(item)}
                  className="flex flex-col items-center gap-1 active:scale-85 transition-transform"
                  aria-label="Поделиться сериалом"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md shadow-lg hover:bg-black/80">
                    {copiedLink ? (
                      <Check className="h-4.5 w-4.5 text-emerald-400" />
                    ) : (
                      <Share2 className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                    {copiedLink ? "Скопировано" : "Ссылка"}
                  </span>
                </button>

                {/* Стрелки быстрой навигации вверх/вниз */}
                <div className="flex flex-col gap-1 pt-0.5">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={scrollToPrev}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white/80 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                      aria-label="Предыдущая серия"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {idx < feedItems.length - 1 && (
                    <button
                      type="button"
                      onClick={scrollToNext}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white/80 hover:text-white backdrop-blur-md active:scale-90 transition-all"
                      aria-label="Следующая серия"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Нижняя информация (TikTok Style) */}
              <div className="absolute left-3.5 bottom-6 right-18 z-20 pointer-events-none">
                {/* Бейджи */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 border border-white/20 px-2 py-0.5 text-[10px] font-black text-white shadow-md backdrop-blur-md">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI Сериал
                  </span>

                  <span className="rounded-full bg-emerald-600/90 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                    RU Озвучка
                  </span>

                  {watched && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Просмотрено
                    </span>
                  )}
                </div>

                {/* Название сериала */}
                <h3 className="text-sm sm:text-base font-black text-white line-clamp-1 drop-shadow-lg tracking-tight">
                  {item.drama.title}
                </h3>

                {/* Название серии и номер */}
                <p className="text-xs text-white/95 font-semibold line-clamp-1 drop-shadow-md mt-0.5">
                  Серия {item.episodeNumber}: {item.episode.title}
                </p>

                {/* Хэштеги сериала */}
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold text-white/80 drop-shadow-md">
                  {item.drama.tags.slice(0, 3).map((tag) => (
                    <span key={tag}>#{tag.replace(/\s+/g, "")}</span>
                  ))}
                  <span>#ВсеСерииПодряд</span>
                </div>
              </div>

              {/* Нижняя полоса прогресса серии */}
              <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15 z-30">
                <div
                  className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      (item.episodeNumber / item.totalEpisodesInDrama) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Анимация подсказки первого свайпа ("Листайте вверх") */}
      {showSwipeHint && (
        <div
          onClick={() => {
            setShowSwipeHint(false);
            scrollToNext();
          }}
          className="absolute inset-x-0 bottom-24 z-40 flex flex-col items-center justify-center gap-1 pointer-events-auto cursor-pointer animate-bounce"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white backdrop-blur-md shadow-xl">
            <ChevronUp className="h-5 w-5" />
          </div>
          <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md border border-white/10 shadow-lg">
            Листайте вверх для следующей серии
          </span>
        </div>
      )}

      {/* Выдвижная шторка выбора серий */}
      {activeItem && (
        <EpisodePickerDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          dramaTitle={activeItem.drama.title}
          episodes={activeItem.drama.episodes || []}
          currentEpisodeNumber={activeItem.episodeNumber}
          lastWatchedEpisodeNumber={
            activeItem.drama.progress?.lastEpisodeNumber || 0
          }
          onSelectEpisode={(selectedEp) => {
            const targetIdx = feedItems.findIndex(
              (it) =>
                it.drama.id === activeItem.drama.id &&
                it.episodeNumber === selectedEp.episodeNumber,
            );
            if (targetIdx >= 0) {
              itemRefs.current[targetIdx]?.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Изолированный видео-плеер для АКТИВНОЙ карточки ленты TikTok.
 * Загружается ровно в 1 экземпляре.
 */
function TikTokEpisodePlayer({
  item,
  isMuted,
  onEnded,
}: {
  item: FeedItem;
  isMuted: boolean;
  onEnded: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [item.episode.videoId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === "onReady") {
          setIsLoading(false);
        } else if (parsed.event === "onStateChange") {
          if (parsed.info === 0 || parsed.data === 0) {
            onEnded();
          } else if (parsed.info === 1 || parsed.data === 1) {
            setIsLoading(false);
          }
        } else if (parsed.event === "onError") {
          setHasError(true);
          setIsLoading(false);
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEnded]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `https://www.youtube.com/embed/${item.episode.videoId}?autoplay=1&mute=${
    isMuted ? 1 : 0
  }&playsinline=1&rel=0&modestbranding=1&enablejsapi=1${
    origin ? `&origin=${encodeURIComponent(origin)}` : ""
  }`;

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={item.episode.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        onLoad={() => setIsLoading(false)}
        className="h-full w-full object-cover pointer-events-auto"
      />

      {/* Индикатор загрузки */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none backdrop-blur-2xs">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Загрузка серии {item.episodeNumber}...</span>
          </div>
        </div>
      )}

      {/* Ошибка встраивания */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-20">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
          <h4 className="text-sm font-bold text-white mb-1">
            Серия {item.episodeNumber} временно недоступна
          </h4>
          <p className="text-xs text-white/70 max-w-xs mb-4">
            Правообладатель ограничил внешнее воспроизведение этой серии.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onEnded}
              className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md active:scale-95 transition-all"
            >
              Смотреть следующую серию
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${item.episode.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              Открыть на YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
