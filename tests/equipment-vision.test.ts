import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("../src/lib/ai/gemini", () => ({ generateGeminiJson: vi.fn() }));
import { generateGeminiJson } from "../src/lib/ai/gemini";
import { detectEquipment } from "../src/lib/workout/equipment-vision";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("falls back to Groq vision on Gemini overload", async () => {
  vi.mocked(generateGeminiJson).mockRejectedValue(new Error("503"));
  vi.stubEnv("GROQ_API_KEY", "test");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"machineName":"Жим ногами"}' } }] }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await detectEquipment({ data: "test", mimeType: "image/jpeg" }, "", z.object({ machineName: z.string() }))).toEqual({ machineName: "Жим ногами" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,test");
});
it("handles invalid fallback output without exposing provider errors", async () => {
  vi.mocked(generateGeminiJson).mockRejectedValue(new Error("503 secret details"));
  vi.stubEnv("GROQ_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [] })));
  await expect(detectEquipment({ data: "test", mimeType: "image/jpeg" }, "", z.object({ machineName: z.string() }))).rejects.toThrow("Не удалось распознать тренажёр");
});
it("tries the final Groq scan after the first scan fails", async () => {
  vi.mocked(generateGeminiJson).mockRejectedValue(new Error("503"));
  vi.stubEnv("GROQ_API_KEY", "test");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("overload", { status: 503 }))
    .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{"machineName":"Жим ногами"}' } }] }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await detectEquipment({ data: "test", mimeType: "image/jpeg" }, "", z.object({ machineName: z.string() }))).toEqual({ machineName: "Жим ногами" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
