import { createClient } from "@/lib/supabase/server";
import { SEED_DRAMAS, SEED_SOURCES } from "./seed-data";
import { syncPlaylistSource } from "./youtube-sync";
import type { Drama, DramaEpisode, DramaWithEpisodes, DramaProgress, ContentSource } from "./types";

// Локальный кэш в памяти на время работы Node-процесса
let inMemoryDramas: DramaWithEpisodes[] = [...SEED_DRAMAS];
const inMemoryProgress: Map<string, DramaProgress> = new Map(); // key: `${userId}:${dramaId}`
const inMemoryFavorites: Set<string> = new Set(); // key: `${userId}:${dramaId}`
let lastSyncTimestamp = 0;
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 минут

export interface GetDramasOptions {
  query?: string;
  tag?: string;
  isAi?: boolean;
  language?: string;
  favoriteOnly?: boolean;
  userId?: string;
}

/**
 * Получение списка сериалов с учётом фильтров и прогресса пользователя
 */
export async function getDramas(options: GetDramasOptions = {}): Promise<Drama[]> {
  const { query, tag, isAi, favoriteOnly, userId } = options;

  let allDramas: DramaWithEpisodes[] = inMemoryDramas;

  // Пытаемся прочитать из Supabase, если таблица создана
  try {
    const supabase = await createClient();
    const { data: dbDramas, error } = await supabase
      .from("dramas")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (!error && dbDramas && dbDramas.length > 0) {
      // Подгружаем эпизоды для сериалов из БД
      const dramaIds = dbDramas.map((d) => d.id);
      const { data: dbEpisodes } = await supabase
        .from("drama_episodes")
        .select("*")
        .in("drama_id", dramaIds)
        .eq("is_available", true)
        .order("episode_number", { ascending: true });

      const episodesMap = new Map<string, DramaEpisode[]>();
      for (const ep of dbEpisodes || []) {
        const list = episodesMap.get(ep.drama_id) || [];
        list.push({
          id: ep.id,
          dramaId: ep.drama_id,
          episodeNumber: ep.episode_number,
          title: ep.title,
          description: ep.description,
          videoId: ep.video_id,
          sourcePlatform: ep.source_platform as "youtube",
          durationSeconds: ep.duration_seconds,
          thumbnailUrl: ep.thumbnail_url,
          isAvailable: ep.is_available,
          createdAt: ep.created_at,
        });
        episodesMap.set(ep.drama_id, list);
      }

      allDramas = dbDramas.map((d) => ({
        id: d.id,
        title: d.title,
        originalTitle: d.original_title,
        description: d.description,
        coverUrl: d.cover_url,
        bannerUrl: d.banner_url,
        tags: d.tags || [],
        isAiGenerated: d.is_ai_generated,
        language: d.language,
        hasRussianVoiceover: d.has_russian_voiceover,
        hasRussianSubtitles: d.has_russian_subtitles,
        sourceType: d.source_type,
        sourceId: d.source_id,
        totalEpisodes: d.total_episodes,
        status: d.status as "ongoing" | "completed",
        viewCount: d.view_count,
        isPublished: d.is_published,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        episodes: episodesMap.get(d.id) || [],
      }));
    }
  } catch (err) {
    // Если таблицы ещё нет в Supabase — используем проверенный inMemoryDramas
    console.warn("Supabase dramas query failed, falling back to local memory store:", err);
  }

  // По умолчанию AI-сериалы идут первыми в выдаче
  allDramas.sort((a, b) => {
    if (a.isAiGenerated && !b.isAiGenerated) return -1;
    if (!a.isAiGenerated && b.isAiGenerated) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Привязываем пользовательский прогресс и избранное
  let userProgressMap = new Map<string, DramaProgress>();
  let userFavorites = new Set<string>();

  if (userId) {
    try {
      const supabase = await createClient();
      const [{ data: progressList }, { data: favList }] = await Promise.all([
        supabase.from("drama_progress").select("*").eq("user_id", userId),
        supabase.from("drama_favorites").select("drama_id").eq("user_id", userId),
      ]);

      if (progressList) {
        for (const p of progressList) {
          userProgressMap.set(p.drama_id, {
            id: p.id,
            userId: p.user_id,
            dramaId: p.drama_id,
            lastEpisodeId: p.last_episode_id,
            lastEpisodeNumber: p.last_episode_number,
            progressSeconds: p.progress_seconds,
            isCompleted: p.is_completed,
            updatedAt: p.updated_at,
          });
        }
      }

      if (favList) {
        for (const f of favList) {
          userFavorites.add(f.drama_id);
        }
      }
    } catch {
      // Читаем из локальной памяти
      for (const [key, prog] of inMemoryProgress.entries()) {
        if (key.startsWith(`${userId}:`)) {
          userProgressMap.set(prog.dramaId, prog);
        }
      }
      for (const favKey of inMemoryFavorites) {
        if (favKey.startsWith(`${userId}:`)) {
          userFavorites.add(favKey.split(":")[1]);
        }
      }
    }
  }

  // Фильтрация (исключительно ИИ-сериалы с русской озвучкой)
  let result = allDramas
    .filter((d) => d.isAiGenerated && d.hasRussianVoiceover)
    .map((d) => ({
      ...d,
      progress: userProgressMap.get(d.id) || null,
      isFavorite: userFavorites.has(d.id),
    }));

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.originalTitle && d.originalTitle.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (tag && tag !== "Все") {
    if (tag === "AI-сериалы") {
      result = result.filter((d) => d.isAiGenerated);
    } else if (tag === "Русская озвучка") {
      result = result.filter((d) => d.hasRussianVoiceover);
    } else if (tag === "Русские субтитры") {
      result = result.filter((d) => d.hasRussianSubtitles);
    } else {
      result = result.filter((d) => d.tags.includes(tag));
    }
  }

  if (isAi !== undefined) {
    result = result.filter((d) => d.isAiGenerated === isAi);
  }

  if (favoriteOnly) {
    result = result.filter((d) => d.isFavorite);
  }

  return result;
}

/**
 * Получение сериала по ID со всеми сериями
 */
export async function getDramaById(id: string, userId?: string): Promise<DramaWithEpisodes | null> {
  const all = await getDramas({ userId });
  const found = all.find((d) => d.id === id);
  if (!found) return null;

  // Находим все эпизоды
  const dramaWithEps = inMemoryDramas.find((d) => d.id === id);
  return {
    ...found,
    episodes: dramaWithEps?.episodes || [],
  };
}

/**
 * Сохранение прогресса просмотра пользователем
 */
export async function saveDramaProgress(
  userId: string,
  dramaId: string,
  episodeId: string,
  episodeNumber: number,
  progressSeconds: number = 0,
  isCompleted: boolean = false,
): Promise<DramaProgress> {
  const now = new Date().toISOString();
  const progress: DramaProgress = {
    userId,
    dramaId,
    lastEpisodeId: episodeId,
    lastEpisodeNumber: episodeNumber,
    progressSeconds,
    isCompleted,
    updatedAt: now,
  };

  // Сохраняем в память
  inMemoryProgress.set(`${userId}:${dramaId}`, progress);

  // Пытаемся сохранить в Supabase
  try {
    const supabase = await createClient();
    await supabase.from("drama_progress").upsert(
      {
        user_id: userId,
        drama_id: dramaId,
        last_episode_id: episodeId,
        last_episode_number: episodeNumber,
        progress_seconds: progressSeconds,
        is_completed: isCompleted,
        updated_at: now,
      },
      { onConflict: "user_id,drama_id" },
    );
  } catch (err) {
    console.warn("Could not save progress to Supabase:", err);
  }

  return progress;
}

/**
 * Переключение статуса "В избранном"
 */
export async function toggleFavorite(userId: string, dramaId: string): Promise<boolean> {
  const key = `${userId}:${dramaId}`;
  const isCurrentlyFav = inMemoryFavorites.has(key);
  const nextFav = !isCurrentlyFav;

  if (nextFav) inMemoryFavorites.add(key);
  else inMemoryFavorites.delete(key);

  try {
    const supabase = await createClient();
    if (nextFav) {
      await supabase.from("drama_favorites").insert({ user_id: userId, drama_id: dramaId });
    } else {
      await supabase.from("drama_favorites").delete().eq("user_id", userId).eq("drama_id", dramaId);
    }
  } catch (err) {
    console.warn("Could not toggle favorite in Supabase:", err);
  }

  return nextFav;
}

/**
 * Синхронизация каталога сериалов из внешних источников
 */
export async function syncDramasFromSources(force: boolean = false): Promise<{
  synced: number;
  errors: string[];
}> {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_INTERVAL_MS) {
    return { synced: inMemoryDramas.length, errors: [] };
  }

  const errors: string[] = [];
  let syncedCount = 0;

  for (const source of SEED_SOURCES) {
    if (!source.isActive) continue;
    try {
      const res = await syncPlaylistSource(source);
      if (res.drama) {
        // Обновляем в локальной памяти
        const existingIdx = inMemoryDramas.findIndex((d) => d.id === res.drama?.id || d.sourceId === source.sourceKey);
        if (existingIdx >= 0) {
          inMemoryDramas[existingIdx] = res.drama;
        } else {
          inMemoryDramas.push(res.drama);
        }
        syncedCount++;

        // Если Supabase доступен — сохраняем туда
        try {
          const supabase = await createClient();
          await supabase.from("dramas").upsert(
            {
              id: res.drama.id,
              title: res.drama.title,
              original_title: res.drama.originalTitle || null,
              description: res.drama.description || null,
              cover_url: res.drama.coverUrl,
              banner_url: res.drama.bannerUrl || null,
              tags: res.drama.tags,
              is_ai_generated: res.drama.isAiGenerated,
              language: res.drama.language,
              has_russian_voiceover: res.drama.hasRussianVoiceover,
              has_russian_subtitles: res.drama.hasRussianSubtitles,
              source_type: res.drama.sourceType,
              source_id: res.drama.sourceId || null,
              total_episodes: res.drama.totalEpisodes,
              status: res.drama.status,
              is_published: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );

          // Сохраняем серии
          for (const ep of res.drama.episodes) {
            await supabase.from("drama_episodes").upsert(
              {
                id: ep.id,
                drama_id: ep.dramaId,
                episode_number: ep.episodeNumber,
                title: ep.title,
                description: ep.description || null,
                video_id: ep.videoId,
                source_platform: ep.sourcePlatform,
                duration_seconds: ep.durationSeconds || null,
                thumbnail_url: ep.thumbnailUrl || null,
                is_available: ep.isAvailable,
              },
              { onConflict: "drama_id,episode_number" },
            );
          }
        } catch {
          // Игнорируем ошибки Supabase, если миграция ещё не применена в облаке
        }
      } else if (res.error) {
        errors.push(`${source.title}: ${res.error}`);
      }
    } catch (err) {
      errors.push(`${source.title}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  lastSyncTimestamp = now;
  return { synced: syncedCount, errors };
}
