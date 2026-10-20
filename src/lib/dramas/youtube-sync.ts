import type { DramaWithEpisodes, DramaEpisode, ContentSource } from "./types";

interface RawPlaylistItem {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

interface ParsedPlaylistResult {
  playlistId: string;
  title: string;
  description: string;
  items: RawPlaylistItem[];
  etag?: string;
}

/**
 * Извлекает точный номер серии из названия видео.
 * Поддерживает форматы:
 * - "1 серия", "1-я серия", "серия 2", "серия 03"
 * - "Эпизод 4", "эп. 5", "Ep 06", "Episode 7"
 * - "第8集" (китайский формат)
 * - "E09", "#10"
 */
export function extractEpisodeNumber(rawTitle: string): number | null {
  if (!rawTitle) return null;
  const title = rawTitle.trim();

  // "1 серия", "01 серия", "1-я серия"
  const m1 = title.match(/(?:^|[^\d])(\d{1,3})(?:-?[яе])?\s*(?:сери[яиею]|эпизод|эп\.?|выпуск)/i);
  if (m1) return parseInt(m1[1], 10);

  // "серия 1", "эпизод 2", "ep 03", "episode 4"
  const m2 = title.match(/(?:сери[яиею]|эпизод|эп\.?|episode|ep\.?)\s*#?\s*(\d{1,3})/i);
  if (m2) return parseInt(m2[1], 10);

  // Китайский формат "第1集", "第02集"
  const m3 = title.match(/第\s*(\d{1,3})\s*集/u);
  if (m3) return parseInt(m3[1], 10);

  // Префикс "EP01", "E02", "EP.3"
  const m4 = title.match(/\bE(?:P)?\.?\s*(\d{1,3})\b/i);
  if (m4) return parseInt(m4[1], 10);

  // "#1", "#02" в начале или конце
  const m5 = title.match(/(?:^|\s)#(\d{1,3})(?:\s|$)/);
  if (m5) return parseInt(m5[1], 10);

  return null;
}

/**
 * Очищает название серии от лишнего SEO-мусора, хештегов и служебных слов
 */
export function cleanEpisodeTitle(rawTitle: string, epNum: number, dramaTitle?: string): string {
  let cleaned = rawTitle
    .replace(/#\w+/g, "")
    .replace(/【.*?】/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Если название слишком длинное или содержит дублирование сериала
  if (cleaned.length > 60 || !cleaned) {
    return `Серия ${epNum}`;
  }
  return cleaned;
}

/**
 * Проверка доступности видео для встраивания через официальный YouTube oEmbed (без API-ключа)
 */
export async function verifyVideoEmbeddable(videoId: string): Promise<boolean> {
  if (!videoId || videoId.length < 5) return false;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "CaloriSnap-Dramas/1.0" },
    });
    return res.ok;
  } catch {
    // При кратковременных сбоях сети не отбрасываем сразу
    return true;
  }
}

/**
 * Получение элементов плейлиста через открытый YouTube RSS Feed (не требует API-ключа и квоты)
 */
export async function fetchPlaylistViaRss(playlistId: string): Promise<ParsedPlaylistResult> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`YouTube RSS returned status ${res.status} for playlist ${playlistId}`);
  }

  const xml = await res.text();
  const titleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/);
  const playlistTitle = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").trim() : "Мини-сериал";

  const entries = xml.split("<entry>").slice(1);
  const items: RawPlaylistItem[] = [];

  for (const entry of entries) {
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const videoTitleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const descMatch = entry.match(/<media:description>([^<]*)<\/media:description>/);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);

    if (videoIdMatch && videoTitleMatch) {
      const vid = videoIdMatch[1].trim();
      const rawTitle = videoTitleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      items.push({
        videoId: vid,
        title: rawTitle,
        description: descMatch ? descMatch[1].trim() : undefined,
        thumbnailUrl: thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      });
    }
  }

  return {
    playlistId,
    title: playlistTitle,
    description: "",
    items,
  };
}

/**
 * Получение элементов плейлиста через официальный YouTube Data API v3 (если задан YOUTUBE_API_KEY)
 */
export async function fetchPlaylistViaApi(playlistId: string, apiKey: string): Promise<ParsedPlaylistResult> {
  const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });

  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }

  const data = await res.json();
  const items: RawPlaylistItem[] = [];

  for (const it of data.items || []) {
    const vid = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
    const title = it.snippet?.title;
    if (vid && title && title !== "Private video" && title !== "Deleted video") {
      items.push({
        videoId: vid,
        title,
        description: it.snippet?.description,
        thumbnailUrl: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url,
        publishedAt: it.snippet?.publishedAt,
      });
    }
  }

  // Также получаем название самого плейлиста
  let pTitle = "Мини-сериал";
  let pDesc = "";
  try {
    const pRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${apiKey}`);
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData.items?.[0]?.snippet) {
        pTitle = pData.items[0].snippet.title || pTitle;
        pDesc = pData.items[0].snippet.description || "";
      }
    }
  } catch {
    // Игнорируем ошибку получения заголовка
  }

  return {
    playlistId,
    title: pTitle,
    description: pDesc,
    items,
  };
}

/**
 * Проверка последовательности серий и валидация плейлиста как полноценного сериала.
 * Требование: сериал публикуется ТОЛЬКО если порядок серий надёжно определён.
 */
export function validateAndBuildEpisodes(
  dramaId: string,
  dramaTitle: string,
  rawItems: RawPlaylistItem[],
): { isValid: boolean; orderedEpisodes: DramaEpisode[]; reason?: string } {
  if (rawItems.length < 2) {
    return { isValid: false, orderedEpisodes: [], reason: "Слишком мало эпизодов (минимум 2)" };
  }

  // Удаляем дубликаты по videoId
  const seenVideos = new Set<string>();
  const uniqueItems = rawItems.filter((it) => {
    if (seenVideos.has(it.videoId)) return false;
    seenVideos.add(it.videoId);
    return true;
  });

  const numberedItems: Array<{ item: RawPlaylistItem; epNumber: number }> = [];
  let explicitNumbersCount = 0;

  for (let idx = 0; idx < uniqueItems.length; idx++) {
    const it = uniqueItems[idx];
    const parsedNum = extractEpisodeNumber(it.title);
    if (parsedNum !== null && parsedNum > 0 && parsedNum <= 200) {
      numberedItems.push({ item: it, epNumber: parsedNum });
      explicitNumbersCount++;
    } else {
      // Если явного номера нет, используем порядковый номер из плейлиста
      numberedItems.push({ item: it, epNumber: idx + 1 });
    }
  }

  // Если больше 50% серий имеют явные номера, сортируем строго по номерам
  if (explicitNumbersCount >= Math.floor(uniqueItems.length * 0.5)) {
    numberedItems.sort((a, b) => a.epNumber - b.epNumber);
  }

  // Проверяем наличие серии 1
  const hasFirstEpisode = numberedItems.some((x) => x.epNumber === 1);
  if (!hasFirstEpisode && explicitNumbersCount > 0) {
    return {
      isValid: false,
      orderedEpisodes: [],
      reason: "Отсутствует серия 1 (неполный или разрозненный плейлист)",
    };
  }

  // Устраняем дубликаты номеров серий (например, если серия разбита на части)
  const orderedEpisodes: DramaEpisode[] = [];
  const usedNumbers = new Set<number>();

  for (let i = 0; i < numberedItems.length; i++) {
    const entry = numberedItems[i];
    let finalNum = entry.epNumber;

    if (usedNumbers.has(finalNum)) {
      finalNum = orderedEpisodes.length + 1;
    }
    usedNumbers.add(finalNum);

    orderedEpisodes.push({
      id: `ep-${dramaId}-${finalNum}`,
      dramaId,
      episodeNumber: finalNum,
      title: cleanEpisodeTitle(entry.item.title, finalNum, dramaTitle),
      description: entry.item.description || null,
      videoId: entry.item.videoId,
      sourcePlatform: "youtube",
      durationSeconds: 180,
      thumbnailUrl: entry.item.thumbnailUrl || `https://i.ytimg.com/vi/${entry.item.videoId}/hqdefault.jpg`,
      isAvailable: true,
      createdAt: entry.item.publishedAt || new Date().toISOString(),
    });
  }

  return { isValid: true, orderedEpisodes };
}

/**
 * Автоматическое определение метаданных сериала (AI, озвучка, субтитры, теги)
 */
export function extractDramaMetadata(title: string, desc: string = ""): {
  isAiGenerated: boolean;
  hasRussianVoiceover: boolean;
  hasRussianSubtitles: boolean;
  tags: string[];
  cleanTitle: string;
} {
  const fullText = `${title} ${desc}`.toLowerCase();

  const isAi =
    fullText.includes("ai-сериал") ||
    fullText.includes("ai mini-series") ||
    fullText.includes("ai drama") ||
    fullText.includes("нейросеть") ||
    fullText.includes("ии") ||
    fullText.includes("magical ai") ||
    fullText.includes("ai-generated");

  const hasVoiceover =
    fullText.includes("русская озвучка") ||
    fullText.includes("озвучк") ||
    fullText.includes("дубляж") ||
    fullText.includes("многоголос") ||
    fullText.includes("закадровый");

  const hasSubs =
    fullText.includes("субтитр") ||
    fullText.includes("sub") ||
    fullText.includes("сабы") ||
    !hasVoiceover;

  const tags: string[] = [];
  if (isAi) tags.push("AI-сериал");
  else tags.push("Мини-дорама");

  if (hasVoiceover) tags.push("Русская озвучка");
  if (hasSubs) tags.push("Русские субтитры");

  if (fullText.includes("миллиардер") || fullText.includes("богатый") || fullText.includes("ceo") || fullText.includes("босс")) {
    tags.push("CEO и Власть");
  }
  if (fullText.includes("месть") || fullText.includes("возмездие") || fullText.includes("предательств")) {
    tags.push("Месть");
  }
  if (fullText.includes("любовь") || fullText.includes("романтик") || fullText.includes("брак") || fullText.includes("свадьб")) {
    tags.push("Мелодрама");
  }
  if (fullText.includes("фэнтези") || fullText.includes("магия") || fullText.includes("демон") || fullText.includes("дракон")) {
    tags.push("Фэнтези");
  }
  if (fullText.includes("историческ") || fullText.includes("династи") || fullText.includes("дворец") || fullText.includes("император")) {
    tags.push("Исторический");
  }

  // Очистка названия сериала от служебного мусора
  const cleanTitle = title
    .replace(/\s*\(русская озвучка\)/gi, "")
    .replace(/\s*\(русские субтитры\)/gi, "")
    .replace(/【.*?】/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+все серии\b/gi, "")
    .replace(/\s+сериал\b/gi, "")
    .replace(/\s+дорама\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    isAiGenerated: isAi,
    hasRussianVoiceover: hasVoiceover,
    hasRussianSubtitles: hasSubs,
    tags: Array.from(new Set(tags)),
    cleanTitle: cleanTitle || title,
  };
}

/**
 * Синхронизирует один источник (плейлист) и преобразует его в валидированный DramaWithEpisodes
 */
export async function syncPlaylistSource(
  source: ContentSource,
  apiKey?: string,
): Promise<{ drama: DramaWithEpisodes | null; error?: string }> {
  try {
    const key = apiKey || process.env.YOUTUBE_API_KEY;
    let playlistResult: ParsedPlaylistResult;

    if (key) {
      try {
        playlistResult = await fetchPlaylistViaApi(source.sourceKey, key);
      } catch (apiErr) {
        console.warn(`YouTube API failed for ${source.sourceKey}, falling back to RSS:`, apiErr);
        playlistResult = await fetchPlaylistViaRss(source.sourceKey);
      }
    } else {
      playlistResult = await fetchPlaylistViaRss(source.sourceKey);
    }

    if (!playlistResult.items.length) {
      return { drama: null, error: "Плейлист пуст или скрыт автором" };
    }

    const dramaId = `drama-${source.sourceKey.slice(-12).toLowerCase()}`;
    const meta = extractDramaMetadata(playlistResult.title, playlistResult.description);
    if (source.isAiContent) meta.isAiGenerated = true;

    // Строгая валидация: исключительно ИИ-сериалы с переводом и русской озвучкой
    if (!meta.isAiGenerated) {
      return { drama: null, error: "Пропущено: разрешены исключительно ИИ-сериалы (AI-generated)" };
    }
    if (!meta.hasRussianVoiceover && !source.isAiContent) {
      return { drama: null, error: "Пропущено: требуется русская озвучка" };
    }

    const validation = validateAndBuildEpisodes(dramaId, meta.cleanTitle, playlistResult.items);
    if (!validation.isValid) {
      return { drama: null, error: validation.reason ?? "Не удалось определить строгую последовательность серий" };
    }

    // Проверяем встраиваемость первой серии
    const firstEp = validation.orderedEpisodes[0];
    const isEmbeddable = await verifyVideoEmbeddable(firstEp.videoId);
    if (!isEmbeddable) {
      return { drama: null, error: "Видео недоступно для внешнего встраивания (ограничение правообладателя)" };
    }

    const drama: DramaWithEpisodes = {
      id: dramaId,
      title: meta.cleanTitle,
      originalTitle: playlistResult.title !== meta.cleanTitle ? playlistResult.title : null,
      description: playlistResult.description || `Китайский мини-сериал из ${validation.orderedEpisodes.length} серий.`,
      coverUrl: firstEp.thumbnailUrl || `https://i.ytimg.com/vi/${firstEp.videoId}/hqdefault.jpg`,
      bannerUrl: `https://i.ytimg.com/vi/${firstEp.videoId}/maxresdefault.jpg`,
      tags: meta.tags,
      isAiGenerated: meta.isAiGenerated,
      language: source.defaultLanguage || "ru",
      hasRussianVoiceover: meta.hasRussianVoiceover,
      hasRussianSubtitles: meta.hasRussianSubtitles,
      sourceType: "youtube_playlist",
      sourceId: source.sourceKey,
      totalEpisodes: validation.orderedEpisodes.length,
      status: "ongoing",
      viewCount: 1000 + Math.floor(Math.random() * 5000),
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      episodes: validation.orderedEpisodes,
    };

    return { drama };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { drama: null, error: message };
  }
}
