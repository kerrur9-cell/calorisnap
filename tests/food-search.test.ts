import { expect, it } from "vitest";
import { foodMatchRank, rankFoods } from "@/lib/food-search";
const basic = (name: string) => ({ name, source: "verified", is_verified: true });
const brand = (name: string) => ({ name, source: "open_food_facts", barcode: "12345678" });
it("plain foods outrank branded matches for everyday queries", () => {
  const simple = basic("Кофе с молоком");
  expect(rankFoods([brand("Кофе с молоком Nescafe Deluxe"), simple, brand("Кофе с молоком · Nescafe")], "кофе с молоком")[0]).toBe(simple);
  for (const query of ["молоко", "йогурт", "рис", "хлеб"]) {
    const simple = basic(query);
    expect(rankFoods([brand(query + " · бренд"), simple], query)[0]).toBe(simple);
  }
});
it("prioritizes basic matches despite typos, case, ё and word order", () => {
  const simple = basic("Кофе с молоком");
  expect(rankFoods([brand("Кофе с молоком бренд"), simple], "кофе молком")[0]).toBe(simple);
  expect(foodMatchRank(basic("Свёкла варёная"), "СВЕКЛА вареная")).toBe(0);
  expect(foodMatchRank(simple, "молоком кофе")).toBe(2);
});
it("keeps explicit brand matches and does not promote unrelated basics", () => {
  const specific = brand("Nescafe Gold");
  expect(rankFoods([basic("Кофе"), specific], "nescafe gold")[0]).toBe(specific);
  expect(rankFoods([basic("Молоко"), brand("Кофе с молоком")], "кофе с молоком")[0].name).toBe("Кофе с молоком");
  expect(foodMatchRank(basic("Латте"), "кофе с молоком")).toBe(4);
});
