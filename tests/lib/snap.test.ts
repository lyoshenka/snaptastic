import { describe, it, expect } from "vitest";
import { validateSnapResponse, MEDIA_TYPE } from "@farcaster/snap";
import { buildSnap, wantsSnapJson, SNAP_MEDIA_TYPE } from "@/lib/snap";

describe("buildSnap", () => {
  it("returns a schema-valid SnapResponse", () => {
    const result = buildSnap({
      blurredUrl: "https://example.com/blur.jpg",
      aspect: "16:9",
      revealUrl: "https://example.com/i/abc12345",
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const snap = result.value;
    expect(snap.version).toBe("2.0");
    expect(snap.theme?.accent).toBe("amber");
    expect(snap.ui.root).toBe("page");
    expect(snap.ui.elements.img.type).toBe("image");
    expect(snap.ui.elements.btn.type).toBe("button");

    // Schema round-trip: the shape we emit is what the spec accepts.
    const v = validateSnapResponse(snap);
    expect(v.valid).toBe(true);
    expect(v.issues).toHaveLength(0);
  });

  it("sets the media type constant to spec value", () => {
    expect(SNAP_MEDIA_TYPE).toBe(MEDIA_TYPE);
    expect(SNAP_MEDIA_TYPE).toBe("application/vnd.farcaster.snap+json");
  });
});

describe("wantsSnapJson", () => {
  it.each([
    [null, true],
    ["*/*", true],
    ["application/vnd.farcaster.snap+json", true],
    ["application/vnd.farcaster.snap+json, text/html;q=0.9", true],
    ["text/html", false],
    ["text/html,application/xhtml+xml", false],
  ])("accept=%s → %s", (accept, expected) => {
    expect(wantsSnapJson(accept)).toBe(expected);
  });
});
