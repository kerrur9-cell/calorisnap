export interface Drama {
  id: string;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  coverUrl: string;
  bannerUrl?: string | null;
  tags: string[];
  isAiGenerated: boolean;
  language: string;
  hasRussianVoiceover: boolean;
  hasRussianSubtitles: boolean;
  sourceType: string;
  sourceId?: string | null;
  totalEpisodes: number;
  status: "ongoing" | "completed";
  viewCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // User-specific properties when authenticated
  progress?: DramaProgress | null;
  isFavorite?: boolean;
  episodes?: DramaEpisode[];
}

export interface DramaEpisode {
  id: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  description?: string | null;
  videoId: string;
  sourcePlatform: "youtube" | "embed";
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  isAvailable: boolean;
  createdAt: string;
}

export interface DramaProgress {
  id?: string;
  userId: string;
  dramaId: string;
  lastEpisodeId: string;
  lastEpisodeNumber: number;
  progressSeconds: number;
  isCompleted: boolean;
  updatedAt: string;
}

export interface DramaWithEpisodes extends Drama {
  episodes: DramaEpisode[];
}

export interface ContentSource {
  id: string;
  title: string;
  platform: "youtube";
  sourceType: "playlist" | "channel" | "search_query";
  sourceKey: string;
  defaultLanguage: string;
  isAiContent: boolean;
  isActive: boolean;
  lastSyncedAt?: string | null;
  lastSyncStatus?: "success" | "error" | "pending";
  lastSyncError?: string | null;
  etag?: string | null;
}
