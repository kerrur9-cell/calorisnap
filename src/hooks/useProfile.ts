"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

import { useFriendView } from "@/context/FriendViewContext";

/**
 * Профиль пользователя. Кэшируется на 5 минут;
 * после сохранения норм вызывайте invalidateProfiles().
 */

export function profileQueryKey(targetUserId?: string | null) {
  return ["profile", targetUserId ?? "self"] as const;
}

export function useProfile(initialProfile?: Profile, overrideUserId?: string | null) {
  const { targetUserId } = useFriendView();
  const effectiveUserId = overrideUserId !== undefined ? overrideUserId : targetUserId;

  return useQuery({
    queryKey: profileQueryKey(effectiveUserId),
    queryFn: async () => {
      const supabase = createClient();

      if (effectiveUserId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", effectiveUserId)
          .single();
        if (error) throw error;
        return data as Profile;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .single();
      if (!error && data) return data as Profile;

      // Если профиль ещё не создан (например, гостевой вход до срабатывания триггера)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: created, error: upsertError } = await supabase
          .from("profiles")
          .upsert({ id: user.id }, { onConflict: "id" })
          .select("*")
          .single();
        if (created) return created as Profile;
        if (upsertError) throw upsertError;
      }

      if (error) throw error;
      return data as Profile;
    },
    staleTime: 5 * 60 * 1000,
    initialData: initialProfile,
    retry: 1,
  });
}

export function useProfileActions() {
  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Войдите в аккаунт заново");
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  }, []);

  return { updateProfile };
}
