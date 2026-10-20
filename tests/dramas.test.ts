import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractEpisodeNumber,
  cleanEpisodeTitle,
  validateAndBuildEpisodes,
  extractDramaMetadata,
} from "../src/lib/dramas/youtube-sync";
import {
  getDramas,
  getDramaById,
  saveDramaProgress,
  toggleFavorite,
} from "../src/lib/dramas/drama-service";

describe("Drama Episode Sequence Parser", () => {
  it("correctly extracts episode numbers from Russian, English and Chinese formats", () => {
    expect(extractEpisodeNumber("Нечисть Яо 1 серия, дорама The Demon")).toBe(1);
    expect(extractEpisodeNumber("Весна пришла - утихла буря 2 серия")).toBe(2);
    expect(extractEpisodeNumber("Серия 3: Пробуждение силы")).toBe(3);
    expect(extractEpisodeNumber("Эпизод 4 / Final")).toBe(4);
    expect(extractEpisodeNumber("AI Mini-Series Ep 05")).toBe(5);
    expect(extractEpisodeNumber("Short Drama EP06 (FULL)")).toBe(6);
    expect(extractEpisodeNumber("Китайский сериал 第7集")).toBe(7);
    expect(extractEpisodeNumber("#08 Возмездие генерала")).toBe(8);
  });

  it("returns null for non-numbered titles and trailers", () => {
    expect(extractEpisodeNumber("Трейлер к сериалу")).toBeNull();
    expect(extractEpisodeNumber("Интервью с актерами")).toBeNull();
    expect(extractEpisodeNumber("")).toBeNull();
  });

  it("cleans episode title from SEO spam and hashtags", () => {
    const raw = "Нечисть Яо 1 серия 【FULL】 дорама The Demon #drama #shorts";
    const cleaned = cleanEpisodeTitle(raw, 1);
    expect(cleaned).not.toContain("#drama");
    expect(cleaned).not.toContain("【FULL】");
  });

  it("validates and strictly orders episodes in sequential order", () => {
    const rawItems = [
      { videoId: "vid-2", title: "Дорама 2 серия" },
      { videoId: "vid-1", title: "Дорама 1 серия" },
      { videoId: "vid-3", title: "Дорама 3 серия" },
    ];

    const result = validateAndBuildEpisodes("test-drama", "Тестовая дорама", rawItems);
    expect(result.isValid).toBe(true);
    expect(result.orderedEpisodes).toHaveLength(3);
    expect(result.orderedEpisodes[0].episodeNumber).toBe(1);
    expect(result.orderedEpisodes[0].videoId).toBe("vid-1");
    expect(result.orderedEpisodes[1].episodeNumber).toBe(2);
    expect(result.orderedEpisodes[1].videoId).toBe("vid-2");
    expect(result.orderedEpisodes[2].episodeNumber).toBe(3);
    expect(result.orderedEpisodes[2].videoId).toBe("vid-3");
  });

  it("rejects broken playlists missing episode 1 when numbered", () => {
    const rawItems = [
      { videoId: "vid-5", title: "Дорама 5 серия" },
      { videoId: "vid-6", title: "Дорама 6 серия" },
    ];

    const result = validateAndBuildEpisodes("test-drama", "Тестовая дорама", rawItems);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("Отсутствует серия 1");
  });

  it("rejects playlists with less than 2 episodes", () => {
    const result = validateAndBuildEpisodes("test-drama", "Тестовая дорама", [
      { videoId: "vid-1", title: "Единственная серия" },
    ]);
    expect(result.isValid).toBe(false);
  });
});

describe("Drama Metadata Classifier", () => {
  it("detects AI generation and sets appropriate tags", () => {
    const meta = extractDramaMetadata("AI Mini-Series: The Secret Heir | Magical AI", "полностью создано нейросетью");
    expect(meta.isAiGenerated).toBe(true);
    expect(meta.tags).toContain("AI-сериал");
  });

  it("detects Russian voiceover and subtitles", () => {
    const metaWithVoice = extractDramaMetadata("Нечисть Яо 1 серия (русская озвучка)");
    expect(metaWithVoice.hasRussianVoiceover).toBe(true);
    expect(metaWithVoice.tags).toContain("Русская озвучка");

    const metaWithSubs = extractDramaMetadata("AI Кибер-Драма с русскими субтитрами");
    expect(metaWithSubs.hasRussianSubtitles).toBe(true);
  });
});

describe("Drama Service", () => {
  it("returns seeded dramas with Russian voiceover and tags", async () => {
    const dramas = await getDramas();
    expect(dramas.length).toBeGreaterThanOrEqual(4);

    const aiDrama = dramas.find((d) => d.isAiGenerated);
    expect(aiDrama).toBeDefined();

    const voiceDrama = dramas.find((d) => d.hasRussianVoiceover);
    expect(voiceDrama).toBeDefined();
  });

  it("filters dramas by search query and tag", async () => {
    const found = await getDramas({ query: "Нечисть" });
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].title).toContain("Нечисть");

    const aiOnly = await getDramas({ tag: "AI-сериалы" });
    expect(aiOnly.every((d) => d.isAiGenerated)).toBe(true);
  });

  it("retrieves a drama by ID with all ordered episodes", async () => {
    const drama = await getDramaById("drama-the-demon-yao");
    expect(drama).toBeDefined();
    expect(drama?.episodes.length).toBeGreaterThanOrEqual(5);
    expect(drama?.episodes[0].episodeNumber).toBe(1);
    expect(drama?.episodes[1].episodeNumber).toBe(2);
  });

  it("records user playback progress and favorites", async () => {
    const userId = "test-user-123";
    const dramaId = "drama-the-demon-yao";

    const progress = await saveDramaProgress(userId, dramaId, "ep-yao-2", 2, 120, false);
    expect(progress.lastEpisodeNumber).toBe(2);

    const isFav = await toggleFavorite(userId, dramaId);
    expect(isFav).toBe(true);

    const userDramas = await getDramas({ userId });
    const updated = userDramas.find((d) => d.id === dramaId);
    expect(updated?.progress?.lastEpisodeNumber).toBe(2);
    expect(updated?.isFavorite).toBe(true);
  });
});
