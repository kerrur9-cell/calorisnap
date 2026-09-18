"""Generate the one-time Open Food Facts seed from its ODbL CSV export.

Run only when refreshing the checked-in migration. The dataset is queried as
one bulk export through Mirabelle, rather than paging the rate-limited API.
"""

import csv
import io
import re
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path


SQL = '''select code, product_name, brands, "energy-kcal_100g" as kcal,
proteins_100g, fat_100g, carbohydrates_100g from [all]
where product_name GLOB "*[А-Яа-яІіЇїЄєҐґ]*"
and "energy-kcal_100g" != "" and proteins_100g != ""
and fat_100g != "" and carbohydrates_100g != "" limit 6500'''
URL = "https://mirabelle.openfoodfacts.org/products.csv?" + urllib.parse.urlencode(
    {"sql": SQL, "_size": "max"}
)
TARGET = Path(__file__).resolve().parents[1] / "supabase/migrations/0004_open_food_facts.sql"
TARGET_CSV = Path(__file__).resolve().parents[1] / "open-food-facts-import.csv"


def number(value, maximum):
    try:
        parsed = Decimal(value)
    except (InvalidOperation, TypeError):
        return None
    if not parsed.is_finite() or parsed < 0 or parsed > maximum:
        return None
    return parsed.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def quote(value):
    return "'" + value.replace("'", "''") + "'"


request = urllib.request.Request(URL, headers={"User-Agent": "CaloriSnap/0.1.0 (https://calorisnap-ai.netlify.app)"})
with urllib.request.urlopen(request, timeout=90) as response:
    rows = list(csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig", newline="")))

values = []
csv_rows = []
seen = set()
for row in rows:
    code = (row.get("code") or "").strip()
    name = " ".join((row.get("product_name") or "").split())
    brand = " ".join((row.get("brands") or "").split(",")[0].split())
    if not re.fullmatch(r"\d{8,14}", code) or code in seen or not name:
        continue
    display = name if not brand or brand.casefold() in name.casefold() else f"{name} · {brand}"
    if len(display) > 200:
        continue
    nutrition = [number(row.get(key), maximum) for key, maximum in [
        ("kcal", 900), ("proteins_100g", 100), ("fat_100g", 100), ("carbohydrates_100g", 100)
    ]]
    if None in nutrition or nutrition[0] == 0 or sum(nutrition[1:]) == 0:
        continue
    seen.add(code)
    values.append("(" + ", ".join([quote(display), quote(code), *(str(x) for x in nutrition)]) + ")")
    csv_rows.append([display, display, code, *(str(x) for x in nutrition), "open_food_facts", "false"])

if len(values) < 4700:
    raise SystemExit(f"Only {len(values)} valid products; import not generated")

header = """-- Open Food Facts, ODbL: https://world.openfoodfacts.org/data
-- Generated from Mirabelle CSV export. Nutrition values are per 100 g.
BEGIN;
DROP POLICY IF EXISTS "read verified or own" ON public.food_items;
CREATE POLICY "read verified or own" ON public.food_items FOR SELECT
  USING (is_verified OR source = 'open_food_facts' OR created_by = public.uid());
"""
parts = [header]
for offset in range(0, len(values), 500):
    chunk = values[offset:offset + 500]
    parts.append("""INSERT INTO public.food_items
  (name, name_local, barcode, calories_per_100g, protein_per_100g,
   fat_per_100g, carbs_per_100g, source, is_verified)
SELECT seed.name, seed.name, seed.barcode, seed.calories, seed.protein,
  seed.fat, seed.carbs, 'open_food_facts', false
FROM (VALUES
""" + ",\n".join(chunk) + "\n) AS seed(name, barcode, calories, protein, fat, carbs)\n" +
"WHERE NOT EXISTS (SELECT 1 FROM public.food_items existing WHERE existing.barcode = seed.barcode);\n")
parts.append("COMMIT;\n")
TARGET.write_text("\n".join(parts), encoding="utf-8")
with TARGET_CSV.open("w", encoding="utf-8-sig", newline="") as output:
    writer = csv.writer(output)
    writer.writerow(["name", "name_local", "barcode", "calories_per_100g", "protein_per_100g",
                     "fat_per_100g", "carbs_per_100g", "source", "is_verified"])
    writer.writerows(csv_rows)
print(f"Generated {len(values)} valid products in {TARGET.name}")
