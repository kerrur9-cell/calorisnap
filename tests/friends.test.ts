import { describe, expect, it } from "vitest";
import {
  isValidFriendCode,
  normalizeFriendCode,
  formatFriendCodeInput,
} from "@/lib/friends/code";

describe("Friend code validation and formatting", () => {
  it("validates correct CAL-XXXX-XXXX codes without confusing characters", () => {
    expect(isValidFriendCode("CAL-2345-6789")).toBe(true);
    expect(isValidFriendCode("CAL-ABCD-EFGH")).toBe(true);
    expect(isValidFriendCode("cal-abcd-efgh")).toBe(true); // case-insensitive check
  });

  it("rejects invalid codes containing 0, O, 1, I or invalid structure", () => {
    expect(isValidFriendCode("CAL-0000-0000")).toBe(false); // contains 0
    expect(isValidFriendCode("CAL-OOOO-OOOO")).toBe(false); // contains O
    expect(isValidFriendCode("CAL-1111-1111")).toBe(false); // contains 1
    expect(isValidFriendCode("CAL-IIII-IIII")).toBe(false); // contains I
    expect(isValidFriendCode("CAL-123-4567")).toBe(false); // too short
    expect(isValidFriendCode("12345678")).toBe(false); // missing prefix
    expect(isValidFriendCode("")).toBe(false);
  });

  it("normalizes input with trimming and uppercase", () => {
    expect(normalizeFriendCode("  cal-2345-6789  ")).toBe("CAL-2345-6789");
  });

  it("formats user keystrokes into clean CAL-XXXX-XXXX representation", () => {
    expect(formatFriendCodeInput("23456789")).toBe("CAL-2345-6789");
    expect(formatFriendCodeInput("cal-2345-6789")).toBe("CAL-2345-6789");
    expect(formatFriendCodeInput("cal23456789")).toBe("CAL-2345-6789");
    expect(formatFriendCodeInput("a-b-c-d")).toBe("CAL-ABCD");
    // filters out O, 0, 1, I
    expect(formatFriendCodeInput("O01I2345")).toBe("CAL-2345");
  });
});
