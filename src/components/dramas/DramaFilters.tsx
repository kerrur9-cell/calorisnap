"use client";

import { Search, X, Sparkles, Star, Mic, Subtitles } from "lucide-react";

interface DramaFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTag: string;
  onTagChange: (t: string) => void;
  showFavoriteOnly: boolean;
  onFavoriteToggle: () => void;
}

const FILTER_PILLS = [
  { id: "Все", label: "Все", icon: null },
  { id: "AI-сериалы", label: "AI-сериалы", icon: Sparkles },
  { id: "Русская озвучка", label: "Русская озвучка", icon: Mic },
  { id: "Русские субтитры", label: "Русские субтитры", icon: Subtitles },
  { id: "CEO и Власть", label: "CEO и Власть", icon: null },
  { id: "Мелодрама", label: "Мелодрама", icon: null },
  { id: "Фэнтези", label: "Фэнтези", icon: null },
  { id: "Исторический", label: "Исторический", icon: null },
];

export function DramaFilters({
  searchQuery,
  onSearchChange,
  activeTag,
  onTagChange,
  showFavoriteOnly,
  onFavoriteToggle,
}: DramaFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Поисковая строка */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по дорамам, актерам и темам..."
          className="w-full h-11 pl-10 pr-9 rounded-2xl bg-card/80 border border-border/70 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Очистить поиск"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Горизонтальный скролл фильтров-пилюль */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {/* Кнопка "Избранное" */}
        <button
          type="button"
          onClick={onFavoriteToggle}
          className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all shadow-2xs active:scale-95 ${
            showFavoriteOnly
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:border-amber-500/40"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${showFavoriteOnly ? "fill-white" : ""}`} />
          Избранное
        </button>

        {FILTER_PILLS.map((pill) => {
          const isActive = !showFavoriteOnly && activeTag === pill.id;
          const Icon = pill.icon;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                if (showFavoriteOnly) onFavoriteToggle();
                onTagChange(pill.id);
              }}
              className={`shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold transition-all shadow-2xs active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
