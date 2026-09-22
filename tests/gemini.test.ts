import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFoodPhoto } from "../src/lib/ai/gemini";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini keys", () => {
  it("uses the separate backup key and model on the second attempt", async () => {
    vi.stubEnv("GEMINI_API_KEY", "first-key");
    vi.stubEnv("GEMINI_FALLBACK_API_KEY", "second-key");
    const analysis = JSON.stringify({
      items: [{ name: "Apple", weight_grams: 100, calories_per_100g: 52,
        protein_per_100g: 0.3, fat_per_100g: 0.2, carbs_per_100g: 14 }],
    });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: analysis }] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { dataBase64: "AAAA", mimeType: "image/jpeg" };

    await analyzeFoodPhoto(input, "primary");
    await analyzeFoodPhoto(input, "secondary");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-3-flash-preview");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("first-key");
    expect(fetchMock.mock.calls[1][0]).toContain("gemini-3.6-flash");
    expect(fetchMock.mock.calls[1][1].headers["x-goog-api-key"]).toBe("second-key");
  });
});
