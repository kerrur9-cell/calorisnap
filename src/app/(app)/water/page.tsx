"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { Droplets, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { todayKey } from "@/lib/utils";

export default function WaterPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background pb-24" />}>
      <WaterFlow />
    </Suspense>
  );
}

const QUICK_AMOUNTS = [200, 250, 500];

function WaterFlow() {
  const queryClient = useQueryClient();
  const [customMl, setCustomMl] = useState("");
  const [entry, setEntry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const { data: profile } = useProfile();

  const dateKey = todayKey();

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["water", dateKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data: entries, error } = await supabase
        .from("water_entries")
        .select("id, amount_ml, created_at")
        .eq("entry_date", dateKey)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        total: (entries ?? []).reduce((a, w) => a + w.amount_ml!, 0),
        entries: entries ?? [],
      };
    },
  });

  const target = profile?.daily_water_ml ?? 2000;
  const percent = target > 0 ? Math.min(100, ((data?.total ?? 0) / target) * 100) : 0;

  async function addWater(ml: number) {
    if (lock.current) return;
    if (!Number.isInteger(ml) || ml <= 0 || ml > 10000) { setError("Укажите целый объём от 1 до 10000 мл"); return; }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Войдите в аккаунт заново");
    const { error } = await supabase.from("water_entries").insert({
      user_id: user.id,
      amount_ml: ml,
      entry_date: dateKey,
    });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["water", dateKey] });
      queryClient.invalidateQueries({ queryKey: ["day", dateKey] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setCustomMl("");
      setEntry(`${ml}`);
      setTimeout(() => setEntry(null), 1500);
    } else throw error;
    } catch { setError("Не удалось сохранить воду. Проверьте подключение."); }
    finally { lock.current = false; setSaving(false); }
  }

  const goalLeft = Math.max(0, target - (data?.total ?? 0));

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/day" className="text-sm text-muted-foreground">
          ← Назад
        </Link>
        <h1 className="text-lg font-bold">Вода</h1>
        <div className="w-10" />
      </header>
      {(error || loadError) && <p role="alert" className="mb-4 text-danger">{error || "Не удалось загрузить воду. Обновите страницу."}</p>}

      <div className="mb-6 flex flex-col items-center rounded-3xl bg-card p-8 text-center shadow-sm">
        <Droplets className="mb-3 h-8 w-8 text-water" />
        <div className="text-5xl font-bold tabular-nums text-water">
          {data?.total ?? 0}
          <span className="text-lg font-normal text-muted-foreground"> мл</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          из {target} мл · осталось {goalLeft} мл
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-water transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Быстрый ввод */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={saving}
            className="flex flex-col items-center gap-1 rounded-2xl bg-card py-4 shadow-sm transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5 text-water" />
            <span className="font-semibold tabular-nums">{ml}</span>
            <span className="text-xs text-muted-foreground">мл</span>
          </button>
        ))}
      </div>

      {/* Свой объём */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const ml = Number(customMl);
          if (ml > 0) {
            addWater(ml);
          }
        }}
        className="mb-6 flex gap-2"
      >
        <input
          type="number"
          inputMode="numeric"
          placeholder="Свой объём, мл"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
          className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 tabular-nums outline-none focus:border-primary"
        />
        <button disabled={saving} className="rounded-2xl bg-primary px-5 font-medium text-primary-foreground">
          Добавить
        </button>
      </form>

      {entry && !isLoading && (
        <div className="mb-4 rounded-xl bg-primary-soft p-3 text-center text-sm text-primary">
          +{entry} мл добавлено 💧
        </div>
      )}

      {/* История сегодня */}
      {data && data.entries.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Сегодня</h2>
          <ul className="space-y-1">
            {data.entries.map((w) => (
              <li key={w.id} className="flex justify-between text-sm tabular-nums">
                <span className="text-muted-foreground">
                  {new Date(w.created_at!).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-medium">{w.amount_ml} мл</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
