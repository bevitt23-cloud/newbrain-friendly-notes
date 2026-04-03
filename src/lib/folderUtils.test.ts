import { describe, it, expect } from "vitest";
import {
  parseFolderPath,
  buildFolderPath,
  getParentFolder,
  getFolderLeaf,
  getTopLevelFolder,
  getFolderDepth,
  isDescendantOf,
  matchesFolderOrDescendant,
  buildFolderTree,
  renameInPath,
} from "./folderUtils";

describe("parseFolderPath", () => {
  it("splits on /", () => {
    expect(parseFolderPath("Biology/Campbell Bio/Ch1")).toEqual([
      "Biology",
      "Campbell Bio",
      "Ch1",
    ]);
  });

  it("handles single-segment (legacy flat folder)", () => {
    expect(parseFolderPath("Unsorted")).toEqual(["Unsorted"]);
  });

  it("filters empty segments", () => {
    expect(parseFolderPath("Biology//Ch1")).toEqual(["Biology", "Ch1"]);
  });
});

describe("buildFolderPath", () => {
  it("joins segments with /", () => {
    expect(buildFolderPath("Biology", "Campbell Bio")).toBe(
      "Biology/Campbell Bio"
    );
  });

  it("trims whitespace", () => {
    expect(buildFolderPath(" Bio ", " Book ")).toBe("Bio/Book");
  });

  it("filters empty segments", () => {
    expect(buildFolderPath("Bio", "", "Ch1")).toBe("Bio/Ch1");
  });
});

describe("getParentFolder", () => {
  it("returns parent path", () => {
    expect(getParentFolder("Biology/Campbell Bio/Ch1")).toBe(
      "Biology/Campbell Bio"
    );
  });

  it("returns null for top-level", () => {
    expect(getParentFolder("Biology")).toBeNull();
  });
});

describe("getFolderLeaf", () => {
  it("returns last segment", () => {
    expect(getFolderLeaf("Biology/Campbell Bio/Ch1")).toBe("Ch1");
  });

  it("returns the folder itself for top-level", () => {
    expect(getFolderLeaf("Biology")).toBe("Biology");
  });
});

describe("getTopLevelFolder", () => {
  it("returns first segment", () => {
    expect(getTopLevelFolder("Biology/Campbell Bio")).toBe("Biology");
  });
});

describe("getFolderDepth", () => {
  it("returns 0 for top-level", () => {
    expect(getFolderDepth("Biology")).toBe(0);
  });

  it("returns 1 for two levels", () => {
    expect(getFolderDepth("Biology/Book")).toBe(1);
  });

  it("returns 2 for three levels", () => {
    expect(getFolderDepth("Biology/Book/Ch1")).toBe(2);
  });
});

describe("isDescendantOf", () => {
  it("returns true for child", () => {
    expect(isDescendantOf("Biology/Book", "Biology")).toBe(true);
  });

  it("returns true for deep descendant", () => {
    expect(isDescendantOf("Biology/Book/Ch1", "Biology")).toBe(true);
  });

  it("returns false for same path", () => {
    expect(isDescendantOf("Biology", "Biology")).toBe(false);
  });

  it("returns false for unrelated", () => {
    expect(isDescendantOf("Math/Calc", "Biology")).toBe(false);
  });

  it("does not match prefix substrings", () => {
    // "Bio" is a prefix of "Biology" but not a parent folder
    expect(isDescendantOf("Biology/Book", "Bio")).toBe(false);
  });
});

describe("matchesFolderOrDescendant", () => {
  it("returns true when no filter", () => {
    expect(matchesFolderOrDescendant("anything", null)).toBe(true);
  });

  it("matches exact folder", () => {
    expect(matchesFolderOrDescendant("Biology", "Biology")).toBe(true);
  });

  it("matches descendant", () => {
    expect(
      matchesFolderOrDescendant("Biology/Book/Ch1", "Biology")
    ).toBe(true);
  });

  it("does not match unrelated folder", () => {
    expect(matchesFolderOrDescendant("Math/Calc", "Biology")).toBe(false);
  });
});

describe("buildFolderTree", () => {
  it("builds a nested tree from flat paths", () => {
    const tree = buildFolderTree({
      Unsorted: 3,
      Biology: 1,
      "Biology/Campbell Bio": 5,
      Math: 2,
    });

    expect(tree).toHaveLength(3); // Unsorted, Biology, Math
    expect(tree[0].fullPath).toBe("Unsorted"); // Unsorted first
    expect(tree[0].noteCount).toBe(3);

    const bio = tree.find((n) => n.name === "Biology")!;
    expect(bio).toBeDefined();
    expect(bio.children).toHaveLength(1);
    expect(bio.children[0].name).toBe("Campbell Bio");
    expect(bio.children[0].noteCount).toBe(5);
  });

  it("computes totalNoteCount", () => {
    const tree = buildFolderTree({
      Biology: 2,
      "Biology/Campbell Bio": 5,
      "Biology/Campbell Bio/Extras": 1,
    });

    const bio = tree.find((n) => n.name === "Biology")!;
    expect(bio.totalNoteCount).toBe(8); // 2 + 5 + 1
    expect(bio.children[0].totalNoteCount).toBe(6); // 5 + 1
  });

  it("creates ancestor nodes for intermediate paths", () => {
    // Only the deep path is provided — parent should be auto-created
    const tree = buildFolderTree({
      "Biology/Campbell Bio": 3,
    });

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Biology");
    expect(tree[0].noteCount).toBe(0); // no direct notes
    expect(tree[0].children[0].name).toBe("Campbell Bio");
    expect(tree[0].children[0].noteCount).toBe(3);
  });

  it("handles empty input", () => {
    expect(buildFolderTree({})).toEqual([]);
  });
});

describe("renameInPath", () => {
  it("renames exact match", () => {
    expect(
      renameInPath("Biology/Campbell Bio", "Biology/Campbell Bio", "Biology/Campbell 12th")
    ).toBe("Biology/Campbell 12th");
  });

  it("renames prefix match (affects descendants)", () => {
    expect(
      renameInPath("Biology/Campbell Bio/Ch1", "Biology", "Bio 101")
    ).toBe("Bio 101/Campbell Bio/Ch1");
  });

  it("does not affect unrelated paths", () => {
    expect(
      renameInPath("Math/Calc", "Biology", "Bio 101")
    ).toBe("Math/Calc");
  });
});
