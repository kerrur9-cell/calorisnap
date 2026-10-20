"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Drama, DramaWithEpisodes, DramaProgress } from "@/lib/dramas/types";

export interface DramaFilters {
  query?: string;
  tag?: string;
  isAi?: boolean;
  favoriteOnly?: boolean;
}

export function useDramas(filters: DramaFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.query) queryParams.set("query", filters.query);
  if (filters.tag && filters.tag !== "Все") queryParams.set("tag", filters.tag);
  if (filters.isAi !== undefined) queryParams.set("isAi", String(filters.isAi));
  if (filters.favoriteOnly) queryParams.set("favoriteOnly", "true");

  const queryString = queryParams.toString();
  const url = `/api/dramas${queryString ? `?${queryString}` : ""}`;

  return useQuery<Drama[]>({
    queryKey: ["dramas", filters],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Не удалось загрузить сериалы");
      const data = await res.json();
      return data.dramas || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useDrama(id: string) {
  return useQuery<DramaWithEpisodes>({
    queryKey: ["drama", id],
    queryFn: async () => {
      const res = await fetch(`/api/dramas/${id}`);
      if (!res.ok) throw new Error("Сериал не найден");
      const data = await res.json();
      return data.drama;
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useSaveDramaProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      dramaId: string;
      episodeId: string;
      episodeNumber: number;
      progressSeconds?: number;
      isCompleted?: boolean;
    }) => {
      const res = await fetch("/api/dramas/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Ошибка сохранения прогресса");
      const data = await res.json();
      return data.progress as DramaProgress;
    },
    onSuccess: (_, variables) => {
      // Инвалидируем кэш сериалов, чтобы отобразить обновлённый прогресс
      queryClient.invalidateQueries({ queryKey: ["dramas"] });
      queryClient.invalidateQueries({ queryKey: ["drama", variables.dramaId] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dramaId: string) => {
      const res = await fetch("/api/dramas/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dramaId }),
      });
      if (!res.ok) throw new Error("Ошибка изменения избранного");
      const data = await res.json();
      return { dramaId, isFavorite: data.isFavorite as boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dramas"] });
    },
  });
}

export function useSyncDramas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dramas/sync", { method: "POST" });
      if (!res.ok) throw new Error("Ошибка синхронизации");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dramas"] });
    },
  });
}
