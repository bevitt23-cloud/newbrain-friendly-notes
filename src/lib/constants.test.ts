import { describe, expect, it } from "vitest";
import { LEARNING_MODE, ENERGY_MODE, FUN_FACT_MODE, DEFAULT_FOLDER } from "./constants";

describe("constants", () => {
  it("learning modes have expected values", () => {
    expect(LEARNING_MODE.ADHD).toBe("adhd");
    expect(LEARNING_MODE.DYSLEXIA).toBe("dyslexia");
    expect(LEARNING_MODE.NEUROTYPICAL).toBe("neurotypical");
    expect(LEARNING_MODE.VISUAL).toBe("visual");
  });

  it("energy modes have expected values", () => {
    expect(ENERGY_MODE.FULL).toBe("full");
    expect(ENERGY_MODE.MINIMAL).toBe("minimal");
    expect(ENERGY_MODE.ZEN).toBe("zen");
  });

  it("fun fact modes have expected values", () => {
    expect(FUN_FACT_MODE.MATERIAL).toBe("material");
    expect(FUN_FACT_MODE.SPECIAL_INTEREST).toBe("special_interest");
    expect(FUN_FACT_MODE.CUSTOM).toBe("custom");
  });

  it("default folder is Unsorted", () => {
    expect(DEFAULT_FOLDER).toBe("Unsorted");
  });
});
