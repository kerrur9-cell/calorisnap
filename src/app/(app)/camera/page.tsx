"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Check,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  Scale,
  UtensilsCrossed,
  Lightbulb,
  Sparkles,
  Camera,
  Utensils,
} from "lucide-react";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { FoodDescriptionInput } from "@/components/camera/FoodDescriptionInput";
import { ConfidenceBadge } from "@/components/ai/ConfidenceBadge";
import { createClient } from "@/lib/supabase/client";
import { macrosForWeight } from "@/lib/nutrition/macros";
import { PREPARATION_FOODS, type PreparationFoodKey, type PreparationState } from "@/lib/nutrition/food-preparation";
import type { AiAnalysisItem, AiAnalysisResponse, AiAnalysisNonFoodResponse } from "@/lib/ai/schema";
import { getNonFoodMeta } from "@/lib/ai/nonFoodPhrases";
import { todayKey } from "@/lib/utils";
import { dayQueryKey } from "@/hooks/useDayLog";
import { useQueryClient } from "@tanstack/react-query";
import { saveMeal } from "@/lib/meals";
import { resolveMealType, nutritionSchema, weightSchema, foodNameSchema } from "@/lib/validation";
import { useFriendView } from "@/context/FriendViewContext";

type Stage = "capture" | "analyzing" | "result" | "error" | "not_food";

interface PhotoInput {
  dataBase64: string;
  mimeType: string;
}

/** Позиция в день, если тип не был передан */

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <CameraFlow />
    </Suspense>
  );
}

function CameraFlow() {
  const router = useRouter();
  const { isGuestView } = useFriendView();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const mealType = resolveMealType(searchParams.get("meal"));
  const pendingMeal = useRef<string | null>(null);
  const saveLock = useRef(false);

  useEffect(() => {
    if (isGuestView) {
      router.replace("/day");
    }
  }, [isGuestView, router]);
  const [stage, setStage] = useState<Stage>("capture");
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const [description, setDescription] = useState("");
  const [textAnalysis, setTextAnalysis] = useState(false);
  const [totalWeight, setTotalWeight] = useState("");
  const [result, setResult] = useState<AiAnalysisResponse | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [analysisAttempt, setAnalysisAttempt] = useState<"openrouter" | "groq" | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  useEffect(() => {
    if (stage !== "error" || retryCountdown === 0) return;
    const timer = window.setTimeout(() => setRetryCountdown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [stage, retryCountdown]);

  async function handleCapture(next: PhotoInput | null, options?: { forceFood?: boolean; description?: string }) {
    if (!next?.dataBase64 && !options?.description) {
      setPhoto(null);
      return;
    }
    setPhoto(next);
    setTextAnalysis(Boolean(options?.description));
    pendingMeal.current = null;
    setStage("analyzing");
    setRetrying(false);
    setAnalysisAttempt(null);
    setError(null);

    const weight = Number(totalWeight.replace(",", "."));

    try {
      const endpoint = options?.description ? "/api/ai/analyze-text" : "/api/ai/analyze";
      const requestBody = JSON.stringify({
        data: next?.dataBase64,
        mime_type: next?.mimeType,
        description: options?.description,
        total_weight_grams: weight > 0 ? weight : undefined,
        force_food: options?.forceFood,
      });
      let res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      let json = await res.json();

      for (let fallback = 0; !res.ok && json.retryable && Boolean(json.nextAttempt) && fallback < 2; fallback++) {
        setRetrying(true);
        setAnalysisAttempt(json.nextAttempt);
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-analysis-attempt": json.nextAttempt },
          body: requestBody,
        });
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(
          json.error ?? "Не удалось проанализировать фото",
        );
      }

      setResult(json);

      if (json.is_food === false) {
        setStage("not_food");
        return;
      }

      setItems(
        (json.items || []).map((it: AiAnalysisItem, idx: number) =>
          toEditable(it, idx, weight, json.scale_detected),
        ),
      );
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка анализа");
      setRetryCountdown(3);
      setStage("error");
    }
  }

  function updateItem(id: string, patch: Partial<EditableItem>) {
    if (("name" in patch || "name_local" in patch || "per100" in patch) && !("referenceFoodKey" in patch)) {
      patch = { ...patch, referenceFoodKey: undefined, preparationState: undefined };
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addEmptyItem() {
    const id = `new-${crypto.randomUUID()}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        name: "",
        name_local: "",
        weightGrams: 100,
        weightSource: "manual",
        per100: { calories: 0, protein: 0, fat: 0, carbs: 0 },
        confidence: 1,
      },
    ]);
    return id;
  }

  function removeItems(ids: string[]) {
    const selected = new Set(ids);
    setItems((prev) => prev.filter((item) => !selected.has(item.id)));
  }

  async function handleConfirm() {
    if (items.length === 0 || saveLock.current) return;
    if (items.some((item) => !foodNameSchema.safeParse(item.name_local || item.name).success ||
      !weightSchema.safeParse(item.weightGrams).success || !nutritionSchema.safeParse(item.per100).success)) {
      setError("Укажите название, вес до 5000 г и корректные неотрицательные БЖУ");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Войдите в аккаунт заново");
    }
    pendingMeal.current ??= crypto.randomUUID();

    // 1. Фото в Storage
    let photoPath: string | null = null;
    if (photo) {
      const ext = photo.mimeType === "image/png" ? "png" : "jpg";
      photoPath = `${user.id}/${pendingMeal.current}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("food-photos")
        .upload(photoPath, base64ToBlob(photo.dataBase64, photo.mimeType), {
          contentType: photo.mimeType,
        });
      if (uploadError && uploadError.message !== "The resource already exists") throw new Error("Не удалось сохранить фото. Попробуйте ещё раз.");
      uploadedPath = photoPath;
    }

    // 2. Приём пищи
    // 3. Продукты
    const rows = items.map((item, idx) => ({
      user_id: user.id,
      custom_food_name: item.name_local || item.name,
      weight_grams: item.weightGrams,
      calories: Math.round(macrosForWeight(item.per100, item.weightGrams).calories),
      protein_g: macrosForWeight(item.per100, item.weightGrams).proteinG,
      fat_g: macrosForWeight(item.per100, item.weightGrams).fatG,
      carbs_g: macrosForWeight(item.per100, item.weightGrams).carbsG,
      weight_source: item.weightSource,
      confidence: item.confidence,
      position: idx,
    }));

    await saveMeal({ id: pendingMeal.current, date: todayKey(), type: mealType,
      items: rows, photoPath, analysis: (result as unknown as import("@/types/database").Json) ?? null });

    queryClient.invalidateQueries({ queryKey: dayQueryKey(todayKey()) });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    router.push("/day");
    } catch (e) {
      // Only compensate after confirming the transaction did not commit.
      // A lost network response must never remove an already-saved meal's photo.
      if (uploadedPath && pendingMeal.current) {
        const client = createClient();
        const check = await client.from("meal_entries").select("id").eq("id", pendingMeal.current).maybeSingle();
        if (!check.error && !check.data) await client.storage.from("food-photos").remove([uploadedPath]);
      }
      setError(e instanceof Error ? e.message : "Не удалось сохранить приём пищи");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => {
          const n = macrosForWeight(it.per100, it.weightGrams);
          return {
            calories: acc.calories + n.calories,
            protein: acc.protein + n.proteinG,
            fat: acc.fat + n.fatG,
            carbs: acc.carbs + n.carbsG,
          };
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 },
      ),
    [items],
  );

  if (isGuestView) {
    return null;
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-8 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/day" className="text-sm text-muted-foreground">
          ← Назад
        </Link>
        <h1 className="text-lg font-bold">Фото еды</h1>
        <div className="w-10" />
      </header>

      {stage === "capture" && (<>
        <CaptureStage
          totalWeight={totalWeight}
          setTotalWeight={setTotalWeight}
          onCapture={handleCapture}
        />
        <div className="mt-4"><FoodDescriptionInput value={description} onChange={setDescription}
          onAnalyze={(text) => handleCapture(null, { description: text })} /></div>
      </>)}

      {stage === "analyzing" && <AnalyzingStage retrying={retrying} attempt={analysisAttempt} textAnalysis={textAnalysis} />}

      {stage === "error" && (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <p className="text-sm">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => textAnalysis ? handleCapture(null, { description }) : photo && handleCapture(photo)}
              disabled={(!photo && !textAnalysis) || retryCountdown > 0}
              className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retryCountdown > 0 ? `Повторить через ${retryCountdown} с` : textAnalysis ? "Отправить описание ещё раз" : "Отправить это фото ещё раз"}
            </button>
            <button
              onClick={() => setStage("capture")}
              className="rounded-full bg-muted px-5 py-2.5 text-sm"
            >
              {textAnalysis ? "Изменить описание" : "Выбрать другое фото"}
            </button>
            <Link
              href={{ pathname: "/foods", query: { meal: mealType } }}
              className="rounded-full bg-muted px-5 py-2.5 text-sm"
            >
              Добавить вручную
            </Link>
          </div>
        </div>
      )}

      {stage === "not_food" && result && !result.is_food && (
        <NotFoodStage
          result={result}
          photo={photo}
          mealType={mealType}
          onRetryCapture={() => setStage("capture")}
          onForceAnalyze={() => photo && handleCapture(photo, { forceFood: true })}
        />
      )}

      {stage === "result" && result && (
        <ResultStage
          items={items}
          updateItem={updateItem}
          addEmptyItem={addEmptyItem}
          removeItems={removeItems}
          totals={totals}
          result={result}
          saving={saving}
          onConfirm={handleConfirm}
          onBack={() => setStage("capture")}
        />
      )}
      {stage === "result" && error && <p role="alert" className="mt-4 text-danger">{error}</p>}
    </main>
  );
}

/* ============ Подэтап: Не еда (остроумный отказ ИИ) ============ */

function NotFoodStage({
  result,
  photo,
  mealType,
  onRetryCapture,
  onForceAnalyze,
}: {
  result: AiAnalysisNonFoodResponse;
  photo: PhotoInput | null;
  mealType: string;
  onRetryCapture: () => void;
  onForceAnalyze: () => void;
}) {
  const meta = getNonFoodMeta(result.not_food_reason);

  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl bg-card border border-border/60 p-6 sm:p-8 text-center shadow-sm animate-in fade-in zoom-in-95 duration-200">
      {/* Иконка / Эмодзи категории */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-soft text-4xl shadow-inner select-none">
          {meta.emoji}
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      {/* Заголовок и бейдж */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground mb-2">
          <span>{meta.badge}</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">{meta.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{meta.subtitle}</p>
      </div>

      {/* Превью фото */}
      {photo?.dataBase64 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-border shadow-sm max-w-[200px] max-h-[160px]">
          {/* Local data-URL preview: no remote image to optimize. */}
          <img
            src={`data:${photo.mimeType};base64,${photo.dataBase64}`}
            alt="Снимок"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end justify-center pb-1.5">
            <span className="text-[11px] font-medium text-white px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs">
              Ваш снимок
            </span>
          </div>
        </div>
      )}

      {/* Остроумный ответ нейросети */}
      <div className="w-full rounded-2xl bg-primary-soft/60 border border-primary/20 p-4 sm:p-5 text-left shadow-xs">
        <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>CaloriSnap AI:</span>
        </div>
        <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
          «{result.funny_response}»
        </p>
      </div>

      {/* Подсказка */}
      <div className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground w-full">
        💡 Приложение считает калории только для еды и напитков. Сфотографируйте вашу тарелку или перекус!
      </div>

      {/* Кнопки действий */}
      <div className="flex flex-col w-full gap-2.5 pt-1">
        <button
          onClick={onRetryCapture}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
        >
          <Camera className="h-4 w-4" />
          Сфотографировать еду
        </button>

        <Link
          href={{ pathname: "/foods", query: { meal: mealType } }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-medium text-foreground hover:bg-muted/80 transition-all"
        >
          <Utensils className="h-4 w-4" />
          Добавить блюдо вручную
        </Link>

        {photo && <button
          onClick={onForceAnalyze}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 py-1.5 transition-colors"
        >
          Это точно еда? Всё равно распознать как блюдо
        </button>}
      </div>
    </div>
  );
}

/* ============ Подэтапы ============ */

function CaptureStage({
  totalWeight,
  setTotalWeight,
  onCapture,
}: {
  totalWeight: string;
  setTotalWeight: (v: string) => void;
  onCapture: (photo: PhotoInput) => void;
}) {
  return (
    <div className="space-y-4">
      <CameraCapture
        onCapture={(p) =>
          onCapture({ dataBase64: p.dataBase64, mimeType: p.mimeType })
        }
      />

      {/* Вес порции */}
      <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
        <Scale className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <div className="font-medium">Общий вес порции</div>
          <div className="text-xs text-muted-foreground">
            Ввели вес с весов? AI распределит его по продуктам
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="—"
            value={totalWeight}
            onChange={(e) => setTotalWeight(e.target.value)}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-primary"
          />
          <span className="text-muted-foreground">г</span>
        </div>
      </div>

      <div className="rounded-2xl bg-primary-soft/80 border border-primary/25 p-4 text-xs sm:text-sm text-foreground/90">
        <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
          <Lightbulb className="h-4 w-4" />
          <span>Совет</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Поставьте тарелку на весы и сфотографируйте сверху. Если на фото виден дисплей весов — приложение само считает вес!
        </p>
      </div>
    </div>
  );
}

const ANALYSIS_MESSAGES = [
  "Пытаемся понять, что на фото…",
  "Отличаем маслины от оливок…",
  "Приглядываемся к ингредиентам…",
  "Считаем примерный размер порции…",
  "Ищем, что спряталось под соусом…",
  "Сверяем калории и БЖУ…",
];

function AnalyzingStage({ retrying, attempt, textAnalysis }: { retrying: boolean; attempt: "openrouter" | "groq" | null; textAnalysis: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);
  useEffect(() => {
    if (retrying) return;
    const timer = window.setInterval(() => setMessageIndex((index) => (index + 1) % ANALYSIS_MESSAGES.length), 3200);
    return () => window.clearInterval(timer);
  }, [retrying]);
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl bg-card p-10 text-center shadow-sm" role="status" aria-live="polite">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft">
        <div className="absolute inset-2 rounded-full border-4 border-primary/20 border-t-primary motion-safe:animate-spin" />
        <UtensilsCrossed className="h-9 w-9 text-primary animate-pulse stroke-[1.8]" />
      </div>
      <div>
        <p className="text-lg font-semibold">{textAnalysis ? "Разбираем описание еды…" : retrying ? "Проверяем фото ещё раз…" : "Распознаём еду…"}</p>
        <p className="mt-2 min-h-10 text-sm text-muted-foreground">
          {attempt === "groq"
            ? "Подключаем запасной анализатор Groq…"
            : attempt === "openrouter"
            ? "Подключаем резервный анализатор OpenRouter…"
            : textAnalysis
            ? "Оцениваем порции и КБЖУ. Результат можно будет поправить."
            : ANALYSIS_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}

/* ============ Результат ============ */

export interface EditableItem {
  id: string;
  name: string;
  name_local: string;
  weightGrams: number;
  weightSource: "scale_ocr" | "user_input" | "ai_estimated" | "manual";
  per100: { calories: number; protein: number; fat: number; carbs: number };
  confidence: number;
  referenceFoodKey?: PreparationFoodKey;
  preparationState?: PreparationState;
}

function toEditable(
  it: AiAnalysisItem,
  idx: number,
  totalWeight: number,
  scaleDetected: boolean,
): EditableItem {
  return {
    id: `ai-${idx}`,
    name: it.name,
    name_local: it.name_local || it.name,
    weightGrams: it.weight_grams,
    weightSource:
      totalWeight > 0
        ? "user_input"
        : scaleDetected
          ? "scale_ocr"
          : "ai_estimated",
    per100: {
      calories: it.calories_per_100g,
      protein: it.protein_per_100g,
      fat: it.fat_per_100g,
      carbs: it.carbs_per_100g,
    },
    confidence: Math.min(it.identification_confidence, totalWeight > 0 ? 1 : it.weight_confidence),
    referenceFoodKey: it.reference_food_key && it.reference_food_key in PREPARATION_FOODS ? it.reference_food_key as PreparationFoodKey : undefined,
    preparationState: it.preparation_state === "dry" ? "dry" : "cooked",
  };
}

function ResultStage({
  items,
  updateItem,
  addEmptyItem,
  removeItems,
  totals,
  result,
  saving,
  onConfirm,
  onBack,
}: {
  items: EditableItem[];
  updateItem: (id: string, patch: Partial<EditableItem>) => void;
  addEmptyItem: () => string;
  removeItems: (ids: string[]) => void;
  totals: { calories: number; protein: number; fat: number; carbs: number };
  result: AiAnalysisResponse;
  saving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id],
    );
  }

  function deleteItems(ids: string[]) {
    removeItems(ids);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (editingId && ids.includes(editingId)) setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Общая уверенность */}
      <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
        <div className="text-sm">
          <div className="font-medium">Определено продуктов</div>
          <div className="text-xs text-muted-foreground">
            {items.length} позиций
          </div>
        </div>
        <ConfidenceBadge value={result.overall_confidence} />
      </div>

      {/* Предупреждения */}
      {result.warnings.length > 0 && (
        <div className="space-y-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          {result.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Список продуктов */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-danger-soft p-3 text-sm">
          <span className="text-danger">Выбрано: {selectedIds.length}</span>
          <button
            onClick={() => deleteItems(selectedIds)}
            className="rounded-full bg-danger px-4 py-2 font-medium text-white"
          >
            Удалить выбранные
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => {
          const nutrition = macrosForWeight(item.per100, item.weightGrams);
          const isEditing = editingId === item.id;
          const isSelected = selectedIds.includes(item.id);
          return (
            <li key={item.id} className="rounded-2xl bg-card p-4 shadow-sm">
              {isEditing ? (
                <EditItemRow
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`Выбрать ${item.name_local || item.name || "продукт"}`}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    />
                    <div className="min-w-0">
                    <div className="font-medium">
                      {item.name_local || item.name || "Продукт"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {Math.round(item.weightGrams)} г · Б {nutrition.proteinG}{" "}
                      Ж {nutrition.fatG} У {nutrition.carbsG}
                    </div>
                    <div className="mt-1">
                      <ConfidenceBadge value={item.confidence} />
                    </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bold tabular-nums">
                      {nutrition.calories} ккал
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingId(item.id)}
                        aria-label="Редактировать"
                        className="rounded-full bg-muted p-2 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItems([item.id])}
                        aria-label="Удалить"
                        className="rounded-full bg-muted p-2 text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {item.referenceFoodKey && (
                <div className="mt-3 border-t border-border pt-3">
                  <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    Вес продукта
                    <select value={item.preparationState || "cooked"}
                      aria-label={`Состояние: ${item.name_local || item.name}`}
                      className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      onChange={(event) => {
                        const state = event.target.value as PreparationState;
                        const reference = PREPARATION_FOODS[item.referenceFoodKey!][state];
                        updateItem(item.id, { name: `${item.referenceFoodKey} ${state}`, name_local: reference.name,
                          per100: { ...reference.per100 }, preparationState: state, referenceFoodKey: item.referenceFoodKey });
                      }}>
                      <option value="cooked">После варки (готовый)</option>
                      <option value="dry">До варки (сухой)</option>
                    </select>
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Справочник: {item.per100.calories} ккал на 100 г. При смене состояния граммы не переводятся — укажи вес {item.preparationState === "dry" ? "сухого" : "готового"} продукта.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Добавить вручную */}
      <button
        onClick={() => {
          const id = addEmptyItem();
          setSelectedIds([]);
          setEditingId(id);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Добавить продукт вручную
      </button>

      {/* Итог */}
      <div className="rounded-2xl bg-primary-soft p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">
            Итого
          </span>
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {totals.calories} <span className="text-sm font-normal">ккал</span>
          </span>
        </div>
        <div className="mt-1 text-xs text-foreground tabular-nums">
          Б {totals.protein} г · Ж {totals.fat} г · У {totals.carbs} г
        </div>
      </div>

      {/* Действия */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="rounded-2xl bg-muted px-6 py-3.5 font-medium"
        >
          Назад
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || items.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Check className="h-5 w-5" /> Добавить в дневник
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Редактирование одного продукта */
function EditItemRow({
  item,
  onChange,
  onDone,
}: {
  item: EditableItem;
  onChange: (patch: Partial<EditableItem>) => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-3">
      <input
        value={item.name_local}
        onChange={(e) => onChange({ name_local: e.target.value, name: e.target.value })}
        placeholder="Название продукта"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-primary"
      />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Вес, г</span>
        <input
          type="number"
          inputMode="decimal"
          value={item.weightGrams}
          onChange={(e) =>
            onChange({ weightGrams: Math.max(1, Number(e.target.value)), weightSource: "user_input" })
          }
          className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-right tabular-nums outline-none focus:border-primary"
        />
      </label>
      <div className="grid grid-cols-4 gap-2 text-sm">
        {(
          [
            ["calories", "ккал"],
            ["protein", "белок"],
            ["fat", "жиры"],
            ["carbs", "углеводы"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-1">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              value={item.per100[key]}
              onChange={(e) =>
                onChange({
                  per100: { ...item.per100, [key]: Number(e.target.value) },
                })
              }
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Значения на 100&nbsp;г продукта
        </span>
        <button
          onClick={onDone}
          className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

/** base64 (core) → Blob */
function base64ToBlob(dataBase64: string, mimeType: string): Blob {
  const byteCharacters = atob(dataBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
