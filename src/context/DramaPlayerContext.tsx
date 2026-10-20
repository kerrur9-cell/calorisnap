"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { Drama, DramaEpisode } from "@/lib/dramas/types";

export interface DramaFeedItem {
  key: string;
  drama: Drama;
  episode: DramaEpisode;
  episodeNumber: number;
  totalEpisodesInDrama: number;
}

interface DramaPlayerContextValue {
  // Умный трекер просмотренного
  watchedMap: Record<string, boolean>; // key: `${dramaId}:${epNum}`
  markWatched: (dramaId: string, epNum: number, watched?: boolean) => void;
  isWatched: (dramaId: string, epNum: number) => boolean;
  isDramaCompleted: (drama: Drama) => boolean;
  getWatchedCount: (dramaId: string) => number;

  // Режим "В окне" (Floating Mini-Player / PiP)
  isMiniPlayerOpen: boolean;
  miniItem: DramaFeedItem | null;
  openMiniPlayer: (item: DramaFeedItem) => void;
  closeMiniPlayer: () => void;
  isMiniMuted: boolean;
  toggleMiniMute: () => void;
  isMiniPlaying: boolean;
  setMiniPlaying: (playing: boolean) => void;
  playNextInMini: () => void;
  playPrevInMini: () => void;

  // Рандомизация ленты
  shuffleDramas: (dramas: Drama[]) => Drama[];
}

const DramaPlayerContext = createContext<DramaPlayerContextValue | null>(null);

const STORAGE_KEY = "calorisnap_watched_episodes_v1";

export function DramaPlayerProvider({ children }: { children: React.ReactNode }) {
  // 1. Умный трекер просмотренных серий (мгновенное сохранение в localStorage)
  const [watchedMap, setWatchedMap] = useState<Record<string, boolean>>({});
  const watchedMapRef = useRef<Record<string, boolean>>({});
  watchedMapRef.current = watchedMap;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setWatchedMap(parsed);
        watchedMapRef.current = parsed;
      }
    } catch {
      // Игнорируем ошибки квоты или JSON
    }
  }, []);

  const markWatched = useCallback((dramaId: string, epNum: number, watched: boolean = true) => {
    setWatchedMap((prev) => {
      if (prev[`${dramaId}:${epNum}`] === watched) return prev;
      const next = { ...prev, [`${dramaId}:${epNum}`]: watched };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Фоновая синхронизация с API
    try {
      fetch("/api/dramas/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dramaId,
          episodeNumber: epNum,
          isCompleted: watched,
        }),
      }).catch(() => {});
    } catch {}
  }, []);

  const isWatched = useCallback(
    (dramaId: string, epNum: number) => {
      return Boolean(watchedMap[`${dramaId}:${epNum}`]);
    },
    [watchedMap]
  );

  const getWatchedCount = useCallback(
    (dramaId: string) => {
      let count = 0;
      for (const key of Object.keys(watchedMap)) {
        if (key.startsWith(`${dramaId}:`) && watchedMap[key]) {
          count++;
        }
      }
      return count;
    },
    [watchedMap]
  );

  const isDramaCompleted = useCallback(
    (drama: Drama) => {
      if (!drama.episodes || drama.episodes.length === 0) return false;
      const watched = getWatchedCount(drama.id);
      return watched >= drama.totalEpisodes;
    },
    [getWatchedCount]
  );

  // 2. Режим "В окне" (Floating Mini-Player / PiP)
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false);
  const [miniItem, setMiniItem] = useState<DramaFeedItem | null>(null);
  const [isMiniMuted, setIsMiniMuted] = useState(false);
  const [isMiniPlaying, setIsMiniPlaying] = useState(true);

  const toggleMiniMute = useCallback(() => {
    setIsMiniMuted((prev) => !prev);
  }, []);

  const openMiniPlayer = useCallback(
    (item: DramaFeedItem) => {
      setMiniItem(item);
      setIsMiniPlayerOpen(true);
      setIsMiniPlaying(true);
      markWatched(item.drama.id, item.episodeNumber);
    },
    [markWatched]
  );

  const closeMiniPlayer = useCallback(() => {
    setIsMiniPlayerOpen(false);
    setIsMiniPlaying(false);
  }, []);

  const playNextInMini = useCallback(() => {
    if (!miniItem) return;
    const episodes = miniItem.drama.episodes || [];
    const sorted = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    const nextEp = sorted.find((e) => e.episodeNumber > miniItem.episodeNumber);
    if (nextEp) {
      const nextItem: DramaFeedItem = {
        key: `${miniItem.drama.id}_ep_${nextEp.episodeNumber}`,
        drama: miniItem.drama,
        episode: nextEp,
        episodeNumber: nextEp.episodeNumber,
        totalEpisodesInDrama: sorted.length,
      };
      setMiniItem(nextItem);
      markWatched(miniItem.drama.id, nextEp.episodeNumber);
    }
  }, [miniItem, markWatched]);

  const playPrevInMini = useCallback(() => {
    if (!miniItem) return;
    const episodes = miniItem.drama.episodes || [];
    const sorted = [...episodes].sort((a, b) => b.episodeNumber - a.episodeNumber);
    const prevEp = sorted.find((e) => e.episodeNumber < miniItem.episodeNumber);
    if (prevEp) {
      const prevItem: DramaFeedItem = {
        key: `${miniItem.drama.id}_ep_${prevEp.episodeNumber}`,
        drama: miniItem.drama,
        episode: prevEp,
        episodeNumber: prevEp.episodeNumber,
        totalEpisodesInDrama: episodes.length,
      };
      setMiniItem(prevItem);
    }
  }, [miniItem]);

  // Синхронизация с системным MediaSession (шторка блокировки телефона, гарнитура, фон)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !miniItem) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${miniItem.drama.title} (Серия ${miniItem.episodeNumber})`,
        artist: "CaloriSnap AI-Сериалы",
        album: miniItem.episode.title || miniItem.drama.title,
        artwork: [
          {
            src: miniItem.episode.thumbnailUrl || miniItem.drama.coverUrl,
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => {
        setIsMiniPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        setIsMiniPlaying(false);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNextInMini();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevInMini();
      });
    } catch {}
  }, [miniItem, playNextInMini, playPrevInMini]);

  // 3. Стабильная рандомизация сериалов (не создает рекурсивных ре-рендеров)
  const shuffleDramas = useCallback((dramas: Drama[]): Drama[] => {
    if (!dramas || dramas.length <= 1) return dramas;

    const currentMap = watchedMapRef.current;
    const isCompleted = (d: Drama) => {
      if (!d.episodes || d.episodes.length === 0) return false;
      let count = 0;
      for (const k of Object.keys(currentMap)) {
        if (k.startsWith(`${d.id}:`) && currentMap[k]) count++;
      }
      return count >= d.totalEpisodes;
    };

    const unwatched: Drama[] = [];
    const completed: Drama[] = [];

    for (const d of dramas) {
      if (isCompleted(d)) {
        completed.push(d);
      } else {
        unwatched.push(d);
      }
    }

    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    return [...shuffle(unwatched), ...shuffle(completed)];
  }, []);

  const value: DramaPlayerContextValue = {
    watchedMap,
    markWatched,
    isWatched,
    isDramaCompleted,
    getWatchedCount,
    isMiniPlayerOpen,
    miniItem,
    openMiniPlayer,
    closeMiniPlayer,
    isMiniMuted,
    toggleMiniMute,
    isMiniPlaying,
    setMiniPlaying: setIsMiniPlaying,
    playNextInMini,
    playPrevInMini,
    shuffleDramas,
  };

  return (
    <DramaPlayerContext.Provider value={value}>
      {children}
    </DramaPlayerContext.Provider>
  );
}

export function useDramaPlayer() {
  const ctx = useContext(DramaPlayerContext);
  if (!ctx) {
    throw new Error("useDramaPlayer must be used within a DramaPlayerProvider");
  }
  return ctx;
}
