import { expect, it } from "vitest";
import { searchMachines } from "../src/lib/workout/machine-search";
it("normalizes Russian spelling and finds common names", () => {
  expect(searchMachines("сгибание ног лежа").map((m) => m.id)).toContain("lying_leg_curl");
  expect(searchMachines("орбитрек").map((m) => m.id)).toContain("elliptical");
  expect(searchMachines("жим ногамм").map((m) => m.id)).toContain("leg_press");
});
it("supports English and filters without hiding all results", () => {
  expect(searchMachines("leg press")[0].id).toBe("leg_press");
  expect(searchMachines("", "cardio").every((m) => m.category === "cardio")).toBe(true);
  expect(searchMachines("несуществующее упражнение")).toEqual([]);
});
