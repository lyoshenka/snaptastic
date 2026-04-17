import { describe, it, expect } from "vitest";
import { newId, newIdPair, ID_REGEX } from "@/lib/ids";

describe("ids", () => {
  it("newId returns 8-char id in url-safe alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const id = newId();
      expect(id).toMatch(ID_REGEX);
      expect(id.length).toBe(8);
    }
  });

  it("newIdPair yields independent ids", () => {
    const seen = new Set<string>();
    let sharedChars = 0;
    for (let i = 0; i < 200; i++) {
      const { snapId, imageId } = newIdPair();
      expect(snapId).not.toBe(imageId);
      expect(seen.has(snapId)).toBe(false);
      expect(seen.has(imageId)).toBe(false);
      seen.add(snapId);
      seen.add(imageId);
      // Sanity: no shared prefix longer than coincidence over many samples
      let p = 0;
      while (p < snapId.length && snapId[p] === imageId[p]) p++;
      sharedChars += p;
    }
    // Average shared prefix across 200 pairs should be tiny with a 55-char alphabet.
    expect(sharedChars / 200).toBeLessThan(1.5);
  });
});
