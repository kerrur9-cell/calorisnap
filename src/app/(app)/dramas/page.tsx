"use client";

import { useState } from "react";
import {
  Film,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  RotateCcw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useDramas, useSyncDramas } from "@/hooks/useDramas";
import { DramaCard } from "@/components/dramas/DramaCard";
import { DramaFilters } from "@/components/dramas/DramaFilters";
import { DramaFeed } from "@/components/dramas/DramaFeed";
import { useDramaPlayer } from "@/context/DramaPlayerContext";
import type { Drama } from "@/lib/dramas/types";

type ViewMode = "feed" | "catalog";

export default function DramasPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState("Все");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const [selectedDramaForFeed, setSelectedDramaForFeed] = useState<string | undefined>();

  const { isDramaCompleted } = useDramaPlayer();

  const { data: rawDramas, isLoading, refetch } = useDramas({
    query: searchQuery,
    tag: activeTag,
    favoriteOnly,
  });

  const dramas = rawDramas?.filter((d) => {
    if (hideWatched && isDramaCompleted(d)) return false;
    return true;
  });

  const syncDramas = useSyncDramas();

  const handlePlayFromCatalog = (drama: Drama) => {
    setSelectedDramaForFeed(drama.id);
    setViewMode("feed");
  };

  const handleManualSync = async () => {
    try {
      await syncDramas.mutateAsync();
      await refetch();
    } catch (err) {
      console.warn("Manual sync error:", err);
    }
  };

  return (
    <main className={`px-3 sm:px-4 ${viewMode === "feed" ? "h-[calc(100dvh-5.5rem)] overflow-hidden pt-1 pb-0" : "min-h-dvh pt-3 pb-8"}`}>
      {/* Шапка раздела */}
      <header className={`flex items-center justify-between ${viewMode === "feed" ? "mb-1.5" : "mb-3.5"}`}>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="rounded-xl bg-violet-500/15 border border-violet-500/30 p-1 sm:p-1.5 shadow-2xs">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
              AI-Сериалы
            </h1>
          </div>
          {viewMode !== "feed" && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Китайские нейросериалы с русской озвучкой
            </p>
          )}
        </div>

        {/* Переключатель режимов: Лента / Каталог */}
        <div className="flex items-center gap-1 rounded-2xl bg-muted/70 p-1 border border-border/60 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode("feed")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "feed"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Лента</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("catalog")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "catalog"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Каталог</span>
          </button>
        </div>
      </header>

      {/* Быстрые фильтры в режиме Ленты */}
      {viewMode === "feed" && (
        <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-3 px-3 sm:-mx-4 sm:px-4">
          <button
            type="button"
            onClick={() => {
              setFavoriteOnly(false);
              setActiveTag("Все");
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              !favoriteOnly && activeTag === "Все"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Все AI-сериалы
          </button>

          <button
            type="button"
            onClick={() => {
              setHideWatched((prev) => !prev);
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              hideWatched
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
            title="Скрыть уже просмотренные сериалы"
          >
            <CheckCircle2 className="h-3 w-3" />
            {hideWatched ? "Только новые" : "Скрыть просмотренные"}
          </button>

          <button
            type="button"
            onClick={() => {
              setFavoriteOnly((prev) => !prev);
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              favoriteOnly
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            ⭐ Избранное
          </button>

          <button
            type="button"
            onClick={() => {
              setFavoriteOnly(false);
              setActiveTag("Бизнес и Успех");
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              !favoriteOnly && activeTag === "Бизнес и Успех"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            Бизнес и Успех
          </button>

          <button
            type="button"
            onClick={() => {
              setFavoriteOnly(false);
              setActiveTag("Катастрофа");
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              !favoriteOnly && activeTag === "Катастрофа"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            Катастрофа
          </button>

          <button
            type="button"
            onClick={() => {
              setFavoriteOnly(false);
              setActiveTag("Месть");
            }}
            className={`shrink-0 inline-flex items-center gap-1 h-7.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
              !favoriteOnly && activeTag === "Месть"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            Месть
          </button>
        </div>
      )}

      {/* Режим 1: Вертикальная бесконечная ЛЕНТА */}
      {viewMode === "feed" && (
        <section className="relative">
          {isLoading ? (
            <div className="flex h-[calc(100dvh-12rem)] w-full items-center justify-center rounded-3xl bg-black/60 border border-border/40">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">Загрузка ленты сериалов...</span>
              </div>
            </div>
          ) : dramas && dramas.length > 0 ? (
            <DramaFeed
              initialDramas={dramas}
              initialDramaId={selectedDramaForFeed}
            />
          ) : (
            <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-6 text-center">
              <Film className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-bold">Сериалы не найдены</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Попробуйте сбросить фильтры или обновить каталог.
              </p>
              <button
                type="button"
                onClick={handleManualSync}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Обновить каталог
              </button>
            </div>
          )}
        </section>
      )}

      {/* Режим 2: КАТАЛОГ */}
      {viewMode === "catalog" && (
        <section className="space-y-4">
          {/* Фильтры и поиск */}
          <DramaFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTag={activeTag}
            onTagChange={setActiveTag}
            showFavoriteOnly={favoriteOnly}
            onFavoriteToggle={() => setFavoriteOnly((prev) => !prev)}
          />

          {/* Строка состояния каталога и кнопка синхронизации */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Каталог: <strong className="text-foreground">{dramas?.length ?? 0}</strong> AI-сериалов
              </span>
              <button
                type="button"
                onClick={() => setHideWatched((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  hideWatched
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {hideWatched ? "Только новые" : "Скрыть просмотренные"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncDramas.isPending}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${syncDramas.isPending ? "animate-spin" : ""}`}
              />
              {syncDramas.isPending ? "Синхронизация..." : "Обновить"}
            </button>
          </div>

          {/* Сетка карточек сериалов */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="aspect-[3/4] animate-pulse rounded-3xl bg-muted/50 border border-border/50"
                />
              ))}
            </div>
          ) : dramas && dramas.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dramas.map((drama) => (
                <DramaCard
                  key={drama.id}
                  drama={drama}
                  onPlayClick={handlePlayFromCatalog}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
              <Film className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold">По вашему запросу ничего не найдено</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Попробуйте изменить поисковую фразу или фильтр
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTag("Все");
                  setFavoriteOnly(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Сбросить фильтры
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
