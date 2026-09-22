import { describe, expect, it } from "vitest";
import { DEFAULT_COLOR_SETTINGS, accentTokens, contrastRatio, normalizeHex, parseColorSettings } from "../src/lib/theme/accent";

describe("accent color tokens", () => {
  it("normalizes valid colors and rejects invalid input", () => {
    expect(normalizeHex("FF2D87")).toBe("#ff2d87");
    expect(normalizeHex("pink")).toBeNull();
  });

  it("chooses readable text for light and dark colors", () => {
    for (const color of ["#ffffff", "#000000", "#34c759", "#ff2d87", "#3478f6"]) {
      const tokens = accentTokens(color, false);
      expect(contrastRatio(tokens.primary, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("creates different soft shades for light and dark themes", () => {
    expect(accentTokens("#8b5cf6", false).soft).not.toBe(accentTokens("#8b5cf6", true).soft);
  });

  it("restores missing or invalid custom colors safely", () => {
    const parsed = parseColorSettings('{"accent":"#ff2d87","protein":"broken","panels":"#123456"}');
    expect(parsed.accent).toBe("#ff2d87");
    expect(parsed.protein).toBe(DEFAULT_COLOR_SETTINGS.protein);
    expect(parsed.panels).toBe("#123456");
  });
});
