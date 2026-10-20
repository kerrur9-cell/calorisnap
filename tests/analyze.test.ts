import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), analyze: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/lib/ai/openrouter", () => ({ analyzeFoodPhotoWithOpenRouter: mocks.analyze }));
vi.mock("@/lib/ai/groq", () => ({ analyzeFoodPhotoWithGroq: mocks.reserve }));
import { POST } from "../src/app/api/ai/analyze/route";
const body = { data: Buffer.from([255,216,255,224]).toString("base64"), mime_type: "image/jpeg" };
function request(value: unknown, origin = "http://localhost:3000", secondary = false) {
  return new NextRequest("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin, "content-type": "application/json", ...(secondary ? { "x-analysis-attempt": "groq" } : {}) }, body: JSON.stringify(value) });
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "alice" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.analyze.mockResolvedValue({ items: [] });
});
describe("AI request boundary", () => {
  it("rejects unauthenticated requests without calling the analyzer", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(body))).status).toBe(401);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("rejects corrupt images and negative weight before analysis", async () => {
    expect((await POST(request({ ...body, total_weight_grams: -1 }))).status).toBe(400);
    expect((await POST(request({ ...body, data: "eHl6eA==" }))).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("sends validated input after authentication", async () => {
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith({ dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined, forceFood: undefined });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("offers Groq only after OpenRouter fails, without a retry cycle", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    mocks.analyze.mockRejectedValue(new Error("OpenRouter не ответил"));
    mocks.reserve.mockRejectedValue(new Error("Groq не ответил"));
    const first = await POST(request(body));
    expect(await first.json()).toMatchObject({ retryable: true, nextAttempt: "groq" });
    const second = await POST(request(body, undefined, true));
    expect((await second.json()).retryable).toBe(false);
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledWith({ dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined, forceFood: undefined });
  });
  it("passes force_food parameter to analyzer", async () => {
    expect((await POST(request({ ...body, force_food: true }))).status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith(
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
    mocks.analyze.mockResolvedValue(nonFoodResult);
    const res = await POST(request(body));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_food).toBe(false);
    expect(data.not_food_reason).toBe("person");
    expect(data.funny_response).toContain("кажется вы");
  });
});
