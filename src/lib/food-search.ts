export type SearchableFood = { id?: string; name?: string | null; name_local?: string | null; barcode?: string | null; source?: string; is_verified?: boolean };
export function normalizeFoodQuery(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function tokens(value: string) { return normalizeFoodQuery(value).split(" ").filter(word => word && !["с", "со", "и", "в", "на", "из"].includes(word)); }
function oneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i = 0, j = 0, errors = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++errors > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return errors + Number(i < a.length || j < b.length) <= 1;
}
const aliases: Record<string, string[]> = {
  "кофе с молоком": ["латте", "капучино"],
  "кофе": ["латте", "капучино", "эспрессо", "американо"],
  "яйцо": ["яйца"], "яйца": ["яйцо"], "курица": ["куриная", "куриное"],
};
export function foodMatchRank(food: SearchableFood, query: string) {
  const q = normalizeFoodQuery(query), words = tokens(q);
  if (!q) return 0;
  const names = [food.name_local, food.name].filter((n): n is string => !!n).map(normalizeFoodQuery);
  return Math.min(99, ...names.map(name => {
    if (name === q) return 0;
    if (name.startsWith(q + " ")) return 1;
    const parts = tokens(name);
    if (words.length && words.every(word => parts.some(part => part === word || part.startsWith(word)))) return 2;
    if (words.length && words.every(word => parts.some(part => oneEdit(word, part)))) return 3;
    if (aliases[q]?.some(alias => parts.includes(alias))) return 4;
    if (name.includes(q)) return 5;
    return 99;
  }));
}
function simplicity(food: SearchableFood) {
  const name = food.name_local || food.name || "";
  const branded = !!food.barcode || food.id?.startsWith("off:") || food.source === "open_food_facts" || name.includes("·");
  if (!branded && (food.is_verified || food.source === "verified")) return 0;
  if (!branded && tokens(name).length <= 5) return 1;
  return 2;
}
export function rankFoods<T extends SearchableFood>(foods: T[], query: string): T[] {
  return foods.map((food, index) => ({ food, index, match: foodMatchRank(food, query), simple: simplicity(food), name: food.name_local || food.name || "" }))
    .sort((a, b) => {
      // An explicit brand query remains exact; unrelated simple food never jumps ahead.
      const group = (match: number) => match === 0 ? 0 : match < 99 ? 1 : 2;
      return group(a.match) - group(b.match) || a.simple - b.simple || a.match - b.match || a.name.length - b.name.length || a.index - b.index;
    }).map(row => row.food);
}
