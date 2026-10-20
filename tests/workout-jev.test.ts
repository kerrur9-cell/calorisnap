import { afterEach, expect, it, vi } from "vitest";
import { chooseWorkoutMachine } from "../src/lib/workout/jev";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("selects only an existing confident catalog item", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ answers: { machine: { type: "choice", choice: "leg_press", confidence: 0.95, probabilities: { leg_press: 0.98 } } } })));
  expect((await chooseWorkoutMachine("жим ногами"))?.machine?.id).toBe("leg_press");
});
it("asks for clarification rather than accepting low confidence", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ answers: { machine: { type: "choice", choice: "leg_press", confidence: 0.3, probabilities: { leg_press: 0.5 } } } })));
  expect(await chooseWorkoutMachine("тренажёр для ног")).toEqual({ machine: null, needsClarification: true });
});
it("does not block extraction on provider failure", async () => {
  vi.stubEnv("TYPESAFE_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect(await chooseWorkoutMachine("жим ногами")).toBeNull();
});
