import { describe, expect, it, vi, afterEach } from "vitest";
import { z } from "zod";
vi.mock("../src/lib/ai/gemini", () => ({ generateGeminiJson: vi.fn() }));
import { generateGeminiJson } from "../src/lib/ai/gemini";
import { extractWorkout, parseSimpleTreadmill } from "../src/lib/workout/extract";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("workout extraction", () => {
  it("never calls Gemini for the exact text from the phone", async () => {
    const result = await extractWorkout("15 минут на беговой дорожке со скоростью 6.7 км/ч", "", z.object({ durationMinutes: z.number(), speedKmh: z.number() }));
    expect(result).toEqual({ durationMinutes: 15, speedKmh: 6.7 });
    expect(generateGeminiJson).not.toHaveBeenCalled();
  });
  it("parses the reported example without inventing incline", () => {
    expect(parseSimpleTreadmill("15 минут на беговой дорожке со скоростью 6.7 км/ч")).toMatchObject({ durationMinutes: 15, speedKmh: 6.7, inclinePercent: null, isAmbiguous: true });
  });
  it("preserves explicit incline and decimal commas", () => {
    expect(parseSimpleTreadmill("15 минут на беговой дорожке со скоростью 6,7 км/ч с наклоном 5%")).toMatchObject({ inclinePercent: 5, speedKmh: 6.7 });
  });
  it("does not guess complex or incomplete descriptions", () => {
    expect(parseSimpleTreadmill("беговая дорожка")).toBeNull();
    expect(parseSimpleTreadmill("15 минут на беговой дорожке со скоростью 6.7 км/ч и жим ногами")).toBeNull();
  });
  it("uses validated Groq extraction only after Gemini fails", async () => {
    vi.mocked(generateGeminiJson).mockRejectedValue(new Error("timeout"));
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"exerciseName":"Жим ногами","calories":9999}' } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractWorkout("жим ногами", "Extract JSON", z.object({ exerciseName: z.string() }));
    expect(result).toEqual({ exerciseName: "Жим ногами" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
