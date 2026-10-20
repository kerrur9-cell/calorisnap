import { afterEach, expect, it, vi } from "vitest";
import { createAdminToken, passwordMatches, sameOrigin, validAdminToken } from "@/lib/push/admin-auth";
import { makeLovingMessage } from "@/lib/push/message";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("accepts public Netlify origin behind internal proxy without trusting spoofed headers", () => {
  vi.stubEnv("NODE_ENV", "production");
  const request = (origin: string) => new Request("http://localhost:8888/api/admin/session", { headers: { origin, "x-forwarded-host": "evil.test" } });
  expect(sameOrigin(request("https://calorisnap-ai.netlify.app"))).toBe(true);
  expect(sameOrigin(request("https://evil.test"))).toBe(false);
  expect(sameOrigin(request("http://localhost:8888"))).toBe(false);
  expect(sameOrigin(new Request("http://localhost:8888/api/admin/session"))).toBe(false);
});
it("admin has server-only password and signed expiring sessions", () => {
  vi.stubEnv("ADMIN_PASSWORD", "test-only"); vi.stubEnv("ADMIN_SESSION_SECRET", "random-test-secret");
  expect(passwordMatches("wrong")).toBe(false); expect(passwordMatches("test-only")).toBe(true);
  const token = createAdminToken(10000);
  expect(validAdminToken(token, 10001)).toBe(true);
  expect(validAdminToken(token, 4000000)).toBe(false);
  expect(validAdminToken(token.slice(0, -3) + "aaa", 10001)).toBe(false);
  expect(validAdminToken("garbage")).toBe(false);
  expect(sameOrigin(new Request("https://test.test/api", { headers: { origin: "https://evil.test" } }))).toBe(false);
});
it("AI messages must address Dasha; failures use a nonrepeating loving fallback", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  const first = await makeLovingMessage(); const second = await makeLovingMessage([first.text]);
  expect(first.generated).toBe(false); expect(first.text).toMatch(/даш/i); expect(second.text).not.toBe(first.text);
  vi.stubEnv("GROQ_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ message: "Дашуля, обнимаю! Загляни в дневник 🌸" }) } }] })));
  expect((await makeLovingMessage()).generated).toBe(true);
});
