import { expect, it } from "vitest";
import { isDue, dueSlot, bonusEnabled } from "../netlify/functions/push-reminders.mjs";
const row = { user_id: "test", enabled: true, timezone: "Europe/Kyiv", last_message: null };
it("sends three meal slots with local timezone and catches up for two hours", () => {
  expect(dueSlot(row, new Date("2026-10-06T08:00:00Z"))).toBe(660);
  expect(dueSlot(row, new Date("2026-10-06T12:00:00Z"))).toBe(900);
  expect(dueSlot(row, new Date("2026-10-06T16:00:00Z"))).toBe(1140);
  expect(isDue(row, new Date("2026-10-06T10:00:00Z"))).toBe(false);
  expect(isDue({ ...row, enabled: false }, new Date("2026-10-06T08:00:00Z"))).toBe(false);
});
it("never resends a recorded slot but sends the next one and the next day", () => {
  const sent = { ...row, last_message: JSON.stringify({ date: "2026-10-06", slots: [660], history: [] }) };
  expect(isDue(sent, new Date("2026-10-06T08:30:00Z"))).toBe(false);
  expect(dueSlot(sent, new Date("2026-10-06T12:00:00Z"))).toBe(900);
  expect(dueSlot(sent, new Date("2026-10-07T08:00:00Z"))).toBe(660);
});
it("bonus decision is stable, roughly half user-days and respects its recorded slot", () => {
  const count = Array.from({ length: 1000 }, (_, i) => bonusEnabled(String(i), "2026-10-06")).filter(Boolean).length;
  expect(count).toBeGreaterThan(440); expect(count).toBeLessThan(560);
  for (let i = 0; i < 20; i++) expect(bonusEnabled("test", "2026-10-06")).toBe(bonusEnabled("test", "2026-10-06"));
  const sent = { ...row, last_message: JSON.stringify({ date: "2026-10-06", slots: [660, 900, 1140, 1230], history: [] }) };
  expect(isDue(sent, new Date("2026-10-06T17:30:00Z"))).toBe(false);
  expect(isDue({ ...row, timezone: "invalid" }, new Date())).toBe(false);
});
