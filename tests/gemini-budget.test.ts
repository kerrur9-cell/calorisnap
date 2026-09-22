import { afterEach, expect, it, vi } from "vitest";
import { generateGeminiJson } from "../src/lib/ai/gemini";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("stops trying keys and models when the shared request budget expires", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_FALLBACK_API_KEY", "test-backup");
  let now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const fetchMock = vi.fn(async () => {
    now = 101;
    return new Response("unavailable", { status: 503 });
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(generateGeminiJson({ prompt: "test", timeoutMs: 100 })).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("includes the requested JSON schema in the provider request", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  const schema = { type: "object", properties: { message: { type: "string" } }, required: ["message"] };
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    expect(JSON.parse(init.body as string).generationConfig.responseJsonSchema).toEqual(schema);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"message":"ok"}' }] } }] });
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(generateGeminiJson({ prompt: "test", responseJsonSchema: schema })).resolves.toEqual({ message: "ok" });
});
