import { afterEach, expect, it, vi } from "vitest";
import { analyzeFoodPhotoWithOpenRouter } from "../src/lib/ai/openrouter";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const input = { dataBase64: "AAAA", mimeType: "image/jpeg" };
it("sends image to a free model and validates its food response", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", " test-key ");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({
    items: [{ name: "Яблоко", weight_grams: 100, calories_per_100g: 52,
      protein_per_100g: 0.3, fat_per_100g: 0.2, carbs_per_100g: 14 }],
  }) } }] }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await analyzeFoodPhotoWithOpenRouter({ ...input, totalWeightGrams: 200 });
  expect(result.items[0].weight_grams).toBe(200);
  const request = fetchMock.mock.calls[0][1];
  expect(request.headers.Authorization).toBe("Bearer test-key");
  const body = JSON.parse(request.body);
  expect(body.model).toMatch(/:free$/);
  expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
  expect(body.messages[0].content[1].image_url.url).toBe("data:image/jpeg;base64,AAAA");
});
it("does not expose provider payloads on quota failure", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret payload", { status: 429 })));
  await expect(analyzeFoodPhotoWithOpenRouter(input)).rejects.toThrow("модель занята или достигнут лимит");
});
it("rejects malformed output instead of saving invented empty data", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "broken" } }] })));
  await expect(analyzeFoodPhotoWithOpenRouter(input)).rejects.toThrow("разобрать");
});
it("blocks accidentally configured paid models", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_VISION_MODEL", "paid-model");
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  await expect(analyzeFoodPhotoWithOpenRouter(input)).rejects.toThrow("бесплатная");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sends text-only food with estimated-weight instructions and a visible warning", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({
    items: [{ name: "Egg", name_local: "Яйцо", weight_grams: 100, calories_per_100g: 155,
      protein_per_100g: 13, fat_per_100g: 11, carbs_per_100g: 1 }],
  }) } }] }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await analyzeFoodPhotoWithOpenRouter({ description: "два яйца" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[0].content).toHaveLength(1);
  expect(body.messages[0].content[0].text).toContain("два яйца");
  expect(body.messages[0].content[0].text).toContain("Если количество не указано");
  expect(result.warnings.join(" ")).toContain("приблизительно");
});
