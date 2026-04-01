import { describe, expect, it } from "vitest";
import { extractYouTubeVideoId, isTranscribableYouTubeUrl } from "@/lib/youtube";

describe("extractYouTubeVideoId", () => {
  it("extracts ID from standard watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID when v is not first query param", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?si=abc123&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://m.youtube.com/watch?time_continue=1&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be, shorts, embed, and live URLs", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=xyz")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtube.com/live/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-video YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBeNull();
    expect(extractYouTubeVideoId("https://youtube.com/@somecreator")).toBeNull();
    expect(extractYouTubeVideoId("https://youtube.com/results?search_query=biology")).toBeNull();
  });
});

describe("isTranscribableYouTubeUrl", () => {
  it("returns true only for URLs with an extractable video ID", () => {
    expect(isTranscribableYouTubeUrl("https://www.youtube.com/watch?si=abc123&v=dQw4w9WgXcQ")).toBe(true);
    expect(isTranscribableYouTubeUrl("https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe(false);
  });
});
