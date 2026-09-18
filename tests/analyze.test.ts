import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), analyze: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/lib/ai/gemini", () => ({ analyzeFoodPhoto: mocks.analyze }));
import { POST } from "../src/app/api/ai/analyze/route";
const body = { data: Buffer.from([255,216,255,224]).toString("base64"), mime_type: "image/jpeg" };
function request(value: unknown, origin = "http://localhost:3000", secondary = false) {
  return new NextRequest("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin, "content-type": "application/json", ...(secondary ? { "x-analysis-attempt": "secondary" } : {}) }, body: JSON.stringify(value) });
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "alice" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.analyze.mockResolvedValue({ items: [] });
});
describe("AI request boundary", () => {
  it("rejects unauthenticated requests without calling Gemini", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(body))).status).toBe(401);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("rejects corrupt images and negative weight before Gemini", async () => {
    expect((await POST(request({ ...body, total_weight_grams: -1 }))).status).toBe(400);
    expect((await POST(request({ ...body, data: "eHl6eA==" }))).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("sends validated input after authentication", async () => {
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith({ dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined }, "primary");
  });
  it("offers the second key only after a failed first analysis", async () => {
    vi.stubEnv("GEMINI_FALLBACK_API_KEY", "test-key");
    mocks.analyze.mockRejectedValue(new Error("Gemini не ответил по сети"));
    const first = await POST(request(body));
    expect((await first.json()).retryable).toBe(true);
    const second = await POST(request(body, undefined, true));
    expect((await second.json()).retryable).toBe(false);
    expect(mocks.analyze).toHaveBeenLastCalledWith({ dataBase64: body.data, mimeType: "image/jpeg", totalWeightGrams: undefined }, "secondary");
  });
});
