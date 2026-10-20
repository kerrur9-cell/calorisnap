import { afterEach, expect, it, vi } from "vitest";
import { generateGeminiJson, analyzeFoodPhoto } from "../src/lib/ai/gemini";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function setup() {
  vi.stubEnv("GEMINI_API_KEY", "primary-test");
  vi.stubEnv("GEMINI_FALLBACK_API_KEY", "reserve-test");
  vi.stubEnv("GEMINI_MODEL", "configured-primary");
  vi.stubEnv("GEMINI_FALLBACK_MODEL", "configured-reserve");
  vi.spyOn(console, "warn").mockImplementation(() => {});
}
function ok() { return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }); }

it("honors configured models and switches to reserve after overload", async () => {
  setup();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("private details", { status: 503 })).mockResolvedValueOnce(ok());
  vi.stubGlobal("fetch", fetchMock);
  expect(await generateGeminiJson({ prompt: "test" })).toEqual({ ok: true });
  expect(fetchMock.mock.calls[0][0]).toContain("configured-primary:");
  expect(fetchMock.mock.calls[1][0]).toContain("configured-reserve:");
  expect(fetchMock.mock.calls[1][1].headers["x-goog-api-key"]).toBe("reserve-test");
});

it("photo stage makes only one call and never exposes raw provider errors", async () => {
  setup();
  const fetchMock = vi.fn().mockResolvedValue(new Response("secret-test", { status: 429 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(analyzeFoodPhoto({ dataBase64: "test", mimeType: "image/jpeg" })).rejects.toThrow("квота");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not repeat a malformed request on every key/model", async () => {
  setup();
  const fetchMock = vi.fn().mockResolvedValue(new Response("secret-test", { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(generateGeminiJson({ prompt: "test" })).rejects.toThrow("обработать");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("bypasses an unpaid reserve key during the secondary photo stage", async () => {
  setup();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("billing", { status: 402 }))
    .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      items: [{ name: "Apple", weight_grams: 100, calories_per_100g: 52,
        protein_per_100g: 0.3, fat_per_100g: 0.2, carbs_per_100g: 14 }],
    }) }] } }] }));
  vi.stubGlobal("fetch", fetchMock);
  await analyzeFoodPhoto({ dataBase64: "test", mimeType: "image/jpeg" }, "secondary");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].headers["x-goog-api-key"]).toBe("primary-test");
});

it("stops at the shared deadline even when a provider call times out", async () => {
  setup();
  const started = Date.now();
  const fetchMock = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(generateGeminiJson({ prompt: "test", timeoutMs: 35 })).rejects.toThrow("не успел");
  expect(Date.now() - started).toBeLessThan(1000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
