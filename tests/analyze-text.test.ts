import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), primary: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/ai/openrouter", () => ({ analyzeFoodPhotoWithOpenRouter: mocks.primary }));
vi.mock("@/lib/ai/groq", () => ({ analyzeFoodPhotoWithGroq: mocks.reserve }));
import { POST } from "../src/app/api/ai/analyze-text/route";
function request(description: string, attempt?: string) {
  return new NextRequest("http://localhost/api/ai/analyze-text", { method: "POST",
    headers: { "Content-Type": "application/json", ...(attempt ? { "x-analysis-attempt": attempt } : {}) },
    body: JSON.stringify({ description }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test" } } });
  mocks.primary.mockResolvedValue({ is_food: true, items: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("requires authentication before sending food descriptions", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  expect((await POST(request("два яйца"))).status).toBe(401);
  expect(mocks.primary).not.toHaveBeenCalled();
});
it("rejects empty and excessive descriptions", async () => {
  expect((await POST(request("  "))).status).toBe(400);
  expect((await POST(request("я".repeat(2001)))).status).toBe(400);
  expect(mocks.primary).not.toHaveBeenCalled();
});
it("analyzes text without requiring or inventing a photo", async () => {
  expect((await POST(request("два яйца и кофе"))).status).toBe(200);
  expect(mocks.primary).toHaveBeenCalledWith({ description: "два яйца и кофе", totalWeightGrams: undefined });
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("falls back once to Groq without Gemini or a retry loop", async () => {
  vi.stubEnv("GROQ_API_KEY", "test");
  mocks.primary.mockRejectedValue(new Error("занят"));
  expect(await (await POST(request("два яйца"))).json()).toMatchObject({ nextAttempt: "groq", retryable: true });
  mocks.reserve.mockRejectedValue(new Error("занят"));
  expect(await (await POST(request("два яйца", "groq"))).json()).toMatchObject({ nextAttempt: null, retryable: false });
  expect(mocks.primary).toHaveBeenCalledTimes(1);
});
