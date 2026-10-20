import type { AiAnalysisResponse } from "../ai/schema";
import type { Per100 } from "./macros";

export type PreparationState = "cooked" | "dry";
// Local reference values, NOT model-generated. Cooked entries mirror
// supabase/seed/0001_foods.sql. Dry entries mirror labelled products in
// 0004_open_food_facts.sql (barcodes below); brands/recipes can differ.
export const PREPARATION_FOODS = {
  buckwheat: {
    aliases: [
      "гречневая каша", "каша гречневая", "гречневая крупа", "крупа гречневая",
      "гречка", "греча", "buckwheat porridge", "buckwheat groats", "buckwheat kasha",
      "cooked buckwheat", "boiled buckwheat", "buckwheat"
    ],
    mentions: /(?:^| )(?:греч\p{L}*|buckwheat)(?: |$)/u,
    cooked: { name: "Гречка варёная", per100: { calories: 110, protein: 4.2, fat: 0.9, carbs: 21.3 } },
    dry: { name: "Гречка сухая", per100: { calories: 340, protein: 15.3, fat: 3.3, carbs: 62.4 } }, // OFF 0659537427370
  },
  rice: {
    aliases: [
      "white rice", "рис белый", "белый рис", "рисовая каша", "каша рисовая",
      "cooked rice", "boiled rice", "steamed rice", "рис", "rice"
    ],
    mentions: /(?:^| )(?:рис\p{L}*|rice)(?: |$)/u,
    cooked: { name: "Рис белый варёный", per100: { calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2 } },
    dry: { name: "Рис белый сухой", per100: { calories: 340, protein: 7, fat: 0.4, carbs: 77 } }, // OFF 4607072714772
  },
  pasta: {
    aliases: [
      "макаронные изделия", "макароны", "спагетти", "паста", "вермишель", "рожки", "перья", "лапша",
      "spaghetti", "pasta", "cooked pasta", "boiled pasta", "cooked spaghetti", "boiled spaghetti", "noodles"
    ],
    mentions: /(?:^| )(?:макарон\p{L}*|спагетти|паст[ауыой]*|spaghetti|pasta)(?: |$)/u,
    cooked: { name: "Макароны варёные", per100: { calories: 158, protein: 5.8, fat: 0.9, carbs: 30.9 } },
    dry: { name: "Макароны сухие", per100: { calories: 342, protein: 12, fat: 1.3, carbs: 70.5 } }, // OFF 4601780009861
  },
} satisfies Record<string, { aliases: string[]; mentions: RegExp; cooked: { name: string; per100: Per100 }; dry: { name: string; per100: Per100 } }>;

export type PreparationFoodKey = keyof typeof PREPARATION_FOODS;
const normalized = (text: string) => text.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const dryWord = /^(?:сух\p{L}*|сыр\p{L}*|dry|raw|uncooked)$/u;
const cookedWord = /^(?:варен\p{L}*|отвар\p{L}*|готов\p{L}*|cooked|boiled|prepared)$/u;
const harmless = new Set([
  "на", "воде", "без", "соли", "добавок", "рассыпчатая", "рассыпчатый", "гарнир", "порция", "простая",
  "plain", "in", "water", "without", "salt", "roasted", "toasted", "kasha", "dish", "side", "steamed", "portion", "simple"
]);

// Intentionally strict: mixed dishes, milk porridge, brown rice, noodles,
// sauces and oils must never be silently replaced with a plain staple.
export function preparationFoodKey(name: string): PreparationFoodKey | null {
  const text = normalized(name);
  for (const [key, food] of Object.entries(PREPARATION_FOODS)) {
    for (const alias of food.aliases) {
      const padded = ` ${text} `, needle = ` ${alias} `;
      if (!padded.includes(needle)) continue;
      const rest = padded.replace(needle, " ").trim().split(/\s+/).filter(Boolean);
      if (rest.every(word => harmless.has(word) || dryWord.test(word) || cookedWord.test(word))) return key as PreparationFoodKey;
    }
  }
  return null;
}

function explicitState(text: string): PreparationState | null {
  const words = normalized(text).split(/\s+/);
  const dry = words.some(word => dryWord.test(word));
  const cooked = words.some(word => cookedWord.test(word));
  if (dry === cooked) return null;
  return dry ? "dry" : "cooked";
}

export function normalizeFoodPreparation(data: AiAnalysisResponse, description?: string): AiAnalysisResponse {
  if (!data.is_food) return data;
  const warnings = new Set(data.warnings);
  const items = data.items.map(item => {
    const localKey = item.name_local ? preparationFoodKey(item.name_local) : null;
    const engKey = item.name ? preparationFoodKey(item.name) : null;
    // A specific Russian dish takes precedence. If localKey is null but item.name_local exists,
    // it could be a mixed dish (e.g. "гречка с курицей") - never override with generic engKey.
    // If no local name is provided, fall back to engKey.
    const key = localKey || (!item.name_local ? engKey : null);
    if (!key) return item;
    // If both local and english names map to recognized staples, they must not contradict each other.
    if (localKey && engKey && localKey !== engKey) return item;
    const food = PREPARATION_FOODS[key];
    let state: PreparationState = "cooked";
    let explicit = false;
    if (description) {
      const clauses = description.split(/[,;\n]|\s+и\s+/i).filter(clause => {
        return food.mentions.test(normalized(clause));
      });
      const states = clauses.map(explicitState).filter((s): s is PreparationState => s !== null);
      if (new Set(states).size > 1) return item;
      if (states.length) { state = states[0]; explicit = true; }
    } else if (item.preparation_state === "dry" && /упаков|пакет|сухие зерна|сухая крупа|package|uncooked grains/i.test(item.notes)) {
      state = "dry"; explicit = true;
    }
    const reference = food[state];
    const per100 = reference.per100;
    warnings.add("Для простых круп и макарон использованы справочные КБЖУ выбранного состояния. Масло и соусы учитывайте отдельно.");
    if (!explicit) warnings.add("Крупа или макароны приняты готовыми. Проверьте состояние и вес перед сохранением.");
    return {
      ...item, name_local: reference.name, name: `${localKey} ${state}`,
      calories_per_100g: per100.calories, protein_per_100g: per100.protein,
      fat_per_100g: per100.fat, carbs_per_100g: per100.carbs,
      preparation_state: state, reference_food_key: localKey,
      notes: `${item.notes}${item.notes ? " " : ""}КБЖУ из справочника приложения (${state === "cooked" ? "готовый" : "сухой"} вес).`,
    };
  });
  return { ...data, items, warnings: [...warnings] };
}
