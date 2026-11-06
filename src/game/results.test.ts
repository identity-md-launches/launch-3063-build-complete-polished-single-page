import { describe, expect, it } from "vitest";
import { compareToHigh } from "./results";

describe("high score comparison", () => {
  it("covers every outcome", () => {
    expect(compareToHigh(0, 0)).toBe("Collect an orb to set a high score.");
    expect(compareToHigh(0, 1500)).toBe("1,500 Aura to beat.");
    expect(compareToHigh(120, 0)).toBe("First high score set.");
    expect(compareToHigh(1620, 1500)).toBe("New high score, up 120 Aura.");
    expect(compareToHigh(1500, 1500)).toBe("You matched your high score.");
    expect(compareToHigh(1240, 1500)).toBe("260 Aura short of your high score.");
  });
});
