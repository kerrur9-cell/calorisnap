import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), consensus: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/ai/consensus", () => ({ analyzeFoodPhotoWithConsensus: mocks.consensus }));

import { POST } from "../src/app/api/ai/analyze-text/route";

function request(description: string, attempt?: string) {
  return new NextRequest("http://localhost/api/ai/analyze-text", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(attempt ? { "x-analysis-attempt": attempt } : {}) },
    body: JSON.stringify({ description }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test" } } });
  mocks.consensus.mockResolvedValue({ is_food: true, items: [] });
});

afterEach(() => vi.unstubAllEnvs());

it("requires authentication before sending food descriptions", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  expect((await POST(request("два яйца"))).status).toBe(401);
  expect(mocks.consensus).not.toHaveBeenCalled();
});

it("rejects empty and excessive descriptions", async () => {
  expect((await POST(request("  "))).status).toBe(400);
  expect((await POST(request("я".repeat(2001)))).status).toBe(400);
  expect(mocks.consensus).not.toHaveBeenCalled();
});

it("analyzes text without requiring or inventing a photo", async () => {
  expect((await POST(request("два яйца и кофе"))).status).toBe(200);
  expect(mocks.consensus).toHaveBeenCalledWith({
    description: "два яйца и кофе",
    totalWeightGrams: undefined,
    forcedProvider: undefined,
  });
});

it("passes forcedProvider when explicit attempt header is provided", async () => {
  expect((await POST(request("два яйца", "groq"))).status).toBe(200);
  expect(mocks.consensus).toHaveBeenCalledWith({
    description: "два яйца",
    totalWeightGrams: undefined,
    forcedProvider: "groq",
  });
});

it("returns error response if consensus analysis fails", async () => {
  mocks.consensus.mockRejectedValue(new Error("Не удалось обработать"));
  const res = await POST(request("два яйца"));
  expect(res.status).toBe(503);
  expect(await res.json()).toMatchObject({ error: "Не удалось обработать", retryable: false });
});

