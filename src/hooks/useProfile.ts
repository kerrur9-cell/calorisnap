"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

/**
 * Профиль пользователя. Кэшируется на 5 минут;
 * после сохранения норм вызывайте invalidateProfiles().
 */

export function useProfile(initialProfile?: Profile) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient();
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

export function profileQueryKey() {
  return ["profile"] as const;
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
