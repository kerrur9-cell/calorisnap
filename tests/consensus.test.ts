import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFoodPhotoWithConsensus } from "../src/lib/ai/consensus";
import { judgeAnalysesWithJev } from "../src/lib/ai/jev-judge";
import type { AiAnalysisResponse } from "../src/lib/ai/schema";

const mocks = vi.hoisted(() => ({
  gemini: vi.fn(),
  openrouter: vi.fn(),
  groq: vi.fn(),
}));

vi.mock("../src/lib/ai/gemini", () => ({ analyzeFoodPhoto: mocks.gemini }));
vi.mock("../src/lib/ai/openrouter", () => ({ analyzeFoodPhotoWithOpenRouter: mocks.openrouter }));
vi.mock("../src/lib/ai/groq", () => ({ analyzeFoodPhotoWithGroq: mocks.groq }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const sampleFood1: AiAnalysisResponse = {
  is_food: true,
  items: [
    {
      name: "Cooked buckwheat",
      name_local: "Гречка варёная",
      weight_grams: 180,
      weight_confidence: 0.9,
      calories_per_100g: 110,
      protein_per_100g: 4.2,
      fat_per_100g: 0.9,
      carbs_per_100g: 21.3,
      identification_confidence: 0.9,
      notes: "варёная",
      preparation_state: "cooked",
    },
  ],
  total_weight_grams: 180,
  scale_detected: false,
  scale_reading: null,
  overall_confidence: 0.9,
  warnings: [],
};

const sampleFood2Dry: AiAnalysisResponse = {
  is_food: true,
  items: [
    {
      name: "Dry buckwheat",
      name_local: "Гречка сухая",
      weight_grams: 180,
      weight_confidence: 0.8,
      calories_per_100g: 340,
      protein_per_100g: 12,
      fat_per_100g: 3,
      carbs_per_100g: 68,
      identification_confidence: 0.8,
      notes: "ошибочно сухое",
      preparation_state: "dry",
    },
  ],
  total_weight_grams: 180,
  scale_detected: false,
  scale_reading: null,
  overall_confidence: 0.7,
  warnings: [],
};

describe("Consensus & JEV Judge Pipeline", () => {
  it("runs all available models in parallel and lets JEV pick the winner", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.stubEnv("TYPESAFE_API_KEY", "typesafe-key");

    mocks.gemini.mockResolvedValue(sampleFood1);
    mocks.openrouter.mockResolvedValue(sampleFood2Dry);
    mocks.groq.mockResolvedValue(sampleFood1);

    // Mock JEV judge API
    const jevFetch = vi.fn().mockResolvedValue(
      Response.json({
        answers: {
          winner: {
            type: "choice",
            choice: "candidate_0",
            confidence: 0.95,
            probabilities: { candidate_0: 0.95, candidate_1: 0.05 },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", jevFetch);

    const input = { dataBase64: "AAAA", mimeType: "image/jpeg" };
    const result = await analyzeFoodPhotoWithConsensus(input);

    expect(mocks.gemini).toHaveBeenCalledTimes(1);
    expect(mocks.openrouter).toHaveBeenCalledTimes(1);
    expect(mocks.groq).toHaveBeenCalledTimes(1);
    expect(result.items[0].calories_per_100g).toBe(110);
    expect(result.warnings.some((w) => w.includes("арбитром JEV"))).toBe(true);
  });

  it("safely proceeds when 1 model fails (e.g. Gemini 503)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("TYPESAFE_API_KEY", "typesafe-key");

    mocks.gemini.mockRejectedValue(new Error("503 Overloaded"));
    mocks.openrouter.mockResolvedValue(sampleFood1);

    const input = { dataBase64: "AAAA", mimeType: "image/jpeg" };
    const result = await analyzeFoodPhotoWithConsensus(input);

    expect(result.items[0].name_local).toBe("Гречка варёная");
    expect(result.items[0].calories_per_100g).toBe(110);
  });

  it("uses heuristic evaluation if JEV API is offline", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", ""); // No key

    const candidates = [
      { provider: "openrouter" as const, data: sampleFood2Dry },
      { provider: "gemini" as const, data: sampleFood1 },
    ];

    const winner = await judgeAnalysesWithJev(candidates);
    expect(winner.data.items[0].calories_per_100g).toBe(110);
    expect(winner.provider).toBe("gemini");
  });
});
