-- Migration 0008: Chinese Mini-Dramas & AI Series

CREATE TABLE IF NOT EXISTS public.dramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_title TEXT,
  description TEXT,
  cover_url TEXT NOT NULL,
  banner_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  language TEXT NOT NULL DEFAULT 'ru',
  has_russian_voiceover BOOLEAN NOT NULL DEFAULT true,
  has_russian_subtitles BOOLEAN NOT NULL DEFAULT true,
  source_type TEXT NOT NULL DEFAULT 'youtube_playlist',
  source_id TEXT,
  total_episodes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ongoing',
  view_count INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drama_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drama_id UUID NOT NULL REFERENCES public.dramas(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_id TEXT NOT NULL,
  source_platform TEXT NOT NULL DEFAULT 'youtube',
  duration_seconds INTEGER DEFAULT 180,
  thumbnail_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drama_episodes_drama_ep_unique UNIQUE (drama_id, episode_number)
);

CREATE TABLE IF NOT EXISTS public.drama_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drama_id UUID NOT NULL REFERENCES public.dramas(id) ON DELETE CASCADE,
  last_episode_id UUID NOT NULL REFERENCES public.drama_episodes(id) ON DELETE CASCADE,
  last_episode_number INTEGER NOT NULL,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drama_progress_user_drama_unique UNIQUE (user_id, drama_id)
);

CREATE TABLE IF NOT EXISTS public.drama_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drama_id UUID NOT NULL REFERENCES public.dramas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drama_favorites_user_drama_unique UNIQUE (user_id, drama_id)
);

CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'youtube',
  source_type TEXT NOT NULL DEFAULT 'playlist',
  source_key TEXT NOT NULL,
  default_language TEXT NOT NULL DEFAULT 'ru',
  is_ai_content BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT NOT NULL DEFAULT 'pending',
  last_sync_error TEXT,
  etag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dramas_published ON public.dramas(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dramas_is_ai ON public.dramas(is_ai_generated);
CREATE INDEX IF NOT EXISTS idx_drama_episodes_lookup ON public.drama_episodes(drama_id, episode_number ASC);
CREATE INDEX IF NOT EXISTS idx_drama_progress_user ON public.drama_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_drama_favorites_user ON public.drama_favorites(user_id);

-- RLS
ALTER TABLE public.dramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drama_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drama_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drama_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;

-- Policies: everyone can read published dramas & episodes
CREATE POLICY "Public read published dramas" ON public.dramas
  FOR SELECT USING (is_published = true);

CREATE POLICY "Public read available episodes" ON public.drama_episodes
  FOR SELECT USING (is_available = true);

-- Users manage their own progress
CREATE POLICY "Users read own drama progress" ON public.drama_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert/update own drama progress" ON public.drama_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users manage their favorites
CREATE POLICY "Users read own favorites" ON public.drama_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert/delete own favorites" ON public.drama_favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Content sources read for authenticated
CREATE POLICY "Authenticated read content sources" ON public.content_sources
  FOR SELECT TO authenticated USING (true);
