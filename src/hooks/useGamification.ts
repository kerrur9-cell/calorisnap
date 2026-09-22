"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "./useProfile";
import { useDayLog } from "./useDayLog";
import { todayKey, addDays } from "@/lib/utils";
import { calculateGamification, type GamificationState } from "@/lib/gamification/engine";

export function useGamification() {
  const { data: profile } = useProfile();
  const today = todayKey();
  const { data: dayLog } = useDayLog(today);

  return useQuery({
    queryKey: ["gamification", profile?.id, dayLog?.totals.calories],
    queryFn: async (): Promise<GamificationState> => {
      const supabase = createClient();
      const past30DaysStart = addDays(today, -30);

      const [statsRes, weightsRes, todayWeightRes] = await Promise.all([
        supabase
          .from("daily_stats")
          .select("*")
          .gte("entry_date", past30DaysStart)
          .lte("entry_date", today),
        supabase.from("weight_entries").select("id", { count: "exact", head: true }),
        supabase.from("weight_entries").select("id").eq("recorded_at", today).limit(1),
      ]);

      const dailyStats = statsRes.data ?? [];
      const weightsCount = weightsRes.count ?? 0;
      const hasWeightToday = (todayWeightRes.data ?? []).length > 0;

      return calculateGamification({
        dailyStats,
        weightsCount,
        targetCalories: profile?.daily_calorie_target ?? 2000,
        targetProtein: profile?.daily_protein_g ?? 120,
        todayTotals: {
          calories: dayLog?.totals.calories ?? 0,
          proteinG: dayLog?.totals.proteinG ?? 0,
          mealCount: dayLog?.mealCount ?? 0,
          hasWeightToday,
        },
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(profile?.id),
  });
}
