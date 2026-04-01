import { describe, expect, it } from "vitest";
import {
  buildRationale,
  collectVideoRenderers,
  getRunText,
  parseVideoResults,
} from "../_shared/youtubeSearchParser";

// ---------------------------------------------------------------------------
// Minimal InnerTube response shapes for testing
// ---------------------------------------------------------------------------

/** WEB client: uses `videoRenderer` */
function makeWebResponse(videos: { id: string; title: string; channel: string; duration: string }[]) {
  return {
    contents: {
      twoColumnSearchResultsRenderer: {
        primaryContents: {
          sectionListRenderer: {
            contents: [
              {
                itemSectionRenderer: {
                  contents: videos.map(({ id, title, channel, duration }) => ({
                    videoRenderer: {
                      videoId: id,
                      title: { runs: [{ text: title }] },
                      ownerText: { runs: [{ text: channel }] },
                      lengthText: { simpleText: duration },
                      thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120 }, { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480 }] },
                    },
                  })),
                },
              },
            ],
          },
        },
      },
    },
  };
}

/** ANDROID client: uses `compactVideoRenderer` */
function makeAndroidResponse(videos: { id: string; title: string; channel: string; duration: string }[]) {
  return {
    contents: {
      sectionListRenderer: {
        contents: [
          {
            itemSectionRenderer: {
              contents: videos.map(({ id, title, channel, duration }) => ({
                compactVideoRenderer: {
                  videoId: id,
                  title: { simpleText: title },
                  longBylineText: { runs: [{ text: channel }] },
                  lengthText: { simpleText: duration },
                  thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120 }, { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480 }] },
                },
              })),
            },
          },
        ],
      },
    },
  };
}

const SAMPLE_VIDEOS = [
  { id: "abc111", title: "Photosynthesis Explained for Beginners", channel: "ScienceChannel", duration: "4:32" },
  { id: "abc222", title: "How Plants Make Food - Quick Guide", channel: "EduTube", duration: "6:15" },
  { id: "abc333", title: "Photosynthesis Deep Dive", channel: "BiologyPro", duration: "18:00" },
  { id: "abc444", title: "Should be ignored (4th result)", channel: "Extra", duration: "2:00" },
];

// ---------------------------------------------------------------------------
// collectVideoRenderers
// ---------------------------------------------------------------------------

describe("collectVideoRenderers", () => {
  it("collects videoRenderer nodes from WEB client response", () => {
    const results = collectVideoRenderers(makeWebResponse(SAMPLE_VIDEOS));
    expect(results).toHaveLength(4);
    expect(results[0].videoId).toBe("abc111");
  });

  it("collects compactVideoRenderer nodes from ANDROID client response", () => {
    const results = collectVideoRenderers(makeAndroidResponse(SAMPLE_VIDEOS));
    expect(results).toHaveLength(4);
    expect(results[0].videoId).toBe("abc111");
  });

  it("returns empty array for empty / null input", () => {
    expect(collectVideoRenderers(null)).toHaveLength(0);
    expect(collectVideoRenderers({})).toHaveLength(0);
    expect(collectVideoRenderers([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getRunText
// ---------------------------------------------------------------------------

describe("getRunText", () => {
  it("reads simpleText", () => {
    expect(getRunText({ simpleText: "Hello" })).toBe("Hello");
  });

  it("concatenates runs", () => {
    expect(getRunText({ runs: [{ text: "Hello" }, { text: " World" }] })).toBe("Hello World");
  });

  it("returns empty string for unrecognised shapes", () => {
    expect(getRunText(null)).toBe("");
    expect(getRunText(42)).toBe("");
    expect(getRunText({})).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseVideoResults — WEB client
// ---------------------------------------------------------------------------

describe("parseVideoResults (WEB client — videoRenderer)", () => {
  it("parses up to 3 videos from a WEB response", () => {
    const videos = parseVideoResults(makeWebResponse(SAMPLE_VIDEOS));
    expect(videos).toHaveLength(3);
    expect(videos[0].videoId).toBe("abc111");
    expect(videos[0].title).toBe("Photosynthesis Explained for Beginners");
    expect(videos[0].channelTitle).toBe("ScienceChannel");
    expect(videos[0].duration).toBe("4:32");
    expect(videos[0].thumbnailUrl).toContain("hqdefault");
  });

  it("falls back to ytimg default thumbnail when thumbnails list is empty", () => {
    const response = makeWebResponse([{ id: "xyz999", title: "No thumbs", channel: "Ch", duration: "1:00" }]);
    // remove thumbnails
    (response as any).contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0]
      .itemSectionRenderer.contents[0].videoRenderer.thumbnail.thumbnails = [];
    const videos = parseVideoResults(response);
    expect(videos[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/xyz999/hqdefault.jpg");
  });

  it("deduplicates videos with the same videoId", () => {
    const dupes = [SAMPLE_VIDEOS[0], SAMPLE_VIDEOS[0], SAMPLE_VIDEOS[1]];
    const videos = parseVideoResults(makeWebResponse(dupes));
    expect(videos).toHaveLength(2);
  });

  it("returns empty array when there are no video renderers", () => {
    expect(parseVideoResults({ contents: {} })).toHaveLength(0);
    expect(parseVideoResults(null)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseVideoResults — ANDROID client
// ---------------------------------------------------------------------------

describe("parseVideoResults (ANDROID client — compactVideoRenderer)", () => {
  it("parses up to 3 videos from an ANDROID response", () => {
    const videos = parseVideoResults(makeAndroidResponse(SAMPLE_VIDEOS));
    expect(videos).toHaveLength(3);
    expect(videos[0].videoId).toBe("abc111");
    expect(videos[0].title).toBe("Photosynthesis Explained for Beginners");
    expect(videos[0].channelTitle).toBe("ScienceChannel");
  });

  it("uses longBylineText as channel fallback", () => {
    const videos = parseVideoResults(makeAndroidResponse([SAMPLE_VIDEOS[0]]));
    // ANDROID response uses longBylineText, not ownerText
    expect(videos[0].channelTitle).toBe("ScienceChannel");
  });
});

// ---------------------------------------------------------------------------
// buildRationale
// ---------------------------------------------------------------------------

describe("buildRationale", () => {
  it("returns beginner cue for beginner-friendly titles", () => {
    const r = buildRationale("photosynthesis", "Photosynthesis for Beginners", "5:00", 0);
    expect(r).toContain("Beginner-friendly");
  });

  it("returns concise cue for short/quick titles", () => {
    const r = buildRationale("photosynthesis", "Quick Overview", "3:00", 2);
    expect(r).toContain("runtime");
  });

  it("returns topic match cue when title matches query word", () => {
    // Title avoids beginner/explained cue words; duration > MM:SS avoids concise cue
    const r = buildRationale("photosynthesis process", "Understanding Photosynthesis", "1:20:00", 2);
    expect(r).toContain("topic match");
  });

  it("returns index-based fallbacks when no other cues match", () => {
    // "xyz" is filtered (length <= 3); title has no cue words; duration in HH:MM:SS doesn't match MM:SS regex
    expect(buildRationale("xyz", "Unrelated Content", "1:20:00", 0)).toContain("Best overall");
    expect(buildRationale("xyz", "Unrelated Content", "1:20:00", 1)).toContain("second angle");
    expect(buildRationale("xyz", "Unrelated Content", "1:20:00", 2)).toContain("varied explanations");
  });
});
