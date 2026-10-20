import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), gemini: vi.fn(), openrouter: vi.fn(), groq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/lib/ai/gemini", () => ({ analyzeFoodPhoto: mocks.gemini }));
vi.mock("@/lib/ai/openrouter", () => ({ analyzeFoodPhotoWithOpenRouter: mocks.openrouter }));
vi.mock("@/lib/ai/groq", () => ({ analyzeFoodPhotoWithGroq: mocks.groq }));
import { POST } from "../src/app/api/ai/analyze/route";
const body = { data: Buffer.from([255,216,255,224]).toString("base64"), mime_type: "image/jpeg" };
function request(value: unknown, origin = "http://localhost:3000", attemptHeader?: string) {
  return new NextRequest("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...(attemptHeader ? { "x-analysis-attempt": attemptHeader } : {}) },
    body: JSON.stringify(value),
  });
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "alice" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.gemini.mockResolvedValue({ items: [] });
  mocks.openrouter.mockResolvedValue({ items: [] });
  mocks.groq.mockResolvedValue({ items: [] });
});
describe("AI request boundary", () => {
  it("rejects unauthenticated requests without calling the analyzer", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(body))).status).toBe(401);
    expect(mocks.gemini).not.toHaveBeenCalled();
  });
  it("rejects corrupt images and negative weight before analysis", async () => {
    expect((await POST(request({ ...body, total_weight_grams: -1 }))).status).toBe(400);
    expect((await POST(request({ ...body, data: "eHl6eA==" }))).status).toBe(400);
    expect(mocks.gemini).not.toHaveBeenCalled();
  });
  it("sends validated input to Gemini first after authentication", async () => {
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.gemini).toHaveBeenCalledWith({ dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined, forceFood: undefined });
    expect(mocks.openrouter).not.toHaveBeenCalled();
    expect(mocks.groq).not.toHaveBeenCalled();
  });
  it("offers OpenRouter after Gemini fails, and Groq after OpenRouter fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-or-key");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    mocks.gemini.mockRejectedValue(new Error("Gemini не ответил"));
    mocks.openrouter.mockRejectedValue(new Error("OpenRouter не ответил"));
    mocks.groq.mockRejectedValue(new Error("Groq не ответил"));

    // Attempt 1: Gemini fails -> offers openrouter
    const first = await POST(request(body));
    expect(await first.json()).toMatchObject({ retryable: true, nextAttempt: "openrouter" });

    // Attempt 2: OpenRouter fails -> offers groq
    const second = await POST(request(body, undefined, "openrouter"));
    expect(await second.json()).toMatchObject({ retryable: true, nextAttempt: "groq" });
    expect(mocks.openrouter).toHaveBeenCalledTimes(1);

    // Attempt 3: Groq fails -> non-retryable
    const third = await POST(request(body, undefined, "groq"));
    expect((await third.json()).retryable).toBe(false);
    expect(mocks.groq).toHaveBeenCalledTimes(1);
  });
  it("passes force_food parameter to analyzer", async () => {
    expect((await POST(request({ ...body, force_food: true }))).status).toBe(200);
    expect(mocks.gemini).toHaveBeenCalledWith(
      { dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined, forceFood: true },
    );
  });
  it("delivers witty non-food rejection cleanly with status 200 without retrying", async () => {
    const nonFoodResult = {
      is_food: false,
      not_food_reason: "person",
      funny_response: "Эй, это кажется вы! Людей мы не едим 😉",
      items: [],
      total_weight_grams: 0,
      scale_detected: false,
      scale_reading: null,
      overall_confidence: 0,
      warnings: [],
    };
    mocks.gemini.mockResolvedValue(nonFoodResult);
    const res = await POST(request(body));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_food).toBe(false);
    expect(data.not_food_reason).toBe("person");
    expect(data.funny_response).toContain("кажется вы");
  });
});
