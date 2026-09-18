import "server-only";

type Product = {
  code?: string;
  product_name?: string;
  product_name_ru?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
};

function nutrition(product: Product) {
  const nutrients = product.nutriments;
  if (!nutrients) return null;
  const read = (key: string) => {
    const value = nutrients[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const calories = read("energy-kcal_100g") ?? ((read("energy-kj_100g") ?? 0) / 4.184);
  const protein = read("proteins_100g");
  const fat = read("fat_100g");
  const carbs = read("carbohydrates_100g");
  if (calories <= 0 || calories > 900 || protein === null || fat === null || carbs === null ||
      [protein, fat, carbs].some((value) => value < 0 || value > 100)) return null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    calories_per_100g: round(calories),
    protein_per_100g: round(protein),
    fat_per_100g: round(fat),
    carbs_per_100g: round(carbs),
  };
}

export async function searchOpenFoodFacts(query: string) {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  for (const [key, value] of Object.entries({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "50",
    fields: "code,product_name,product_name_ru,brands,nutriments",
  })) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "User-Agent": "CaloriSnap/0.1.0 (https://calorisnap-ai.netlify.app)" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Open Food Facts временно недоступен");
  if (!(response.headers.get("content-type") ?? "").includes("json")) throw new Error("Open Food Facts вернул неверный ответ");
  const body = await response.json();
  if (!Array.isArray(body.products)) throw new Error("Open Food Facts вернул неверный ответ");
  return (body.products as Product[]).flatMap((product) => {
    const name = (product.product_name_ru || product.product_name || "").trim();
    const macros = nutrition(product);
    if (!name || !macros || !/^\d{8,14}$/.test(product.code ?? "")) return [];
    const brand = product.brands?.split(",")[0]?.trim();
    return [{
      id: `off:${product.code}`,
      name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name,
      name_local: null,
      ...macros,
    }];
  }).slice(0, 30);
}
