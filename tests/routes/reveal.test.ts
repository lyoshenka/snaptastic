import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findByImageId, insertSnap } from "@/lib/db";
import { makeTestDb, resetDb } from "./helpers";

describe("findByImageId (reveal page lookup)", () => {
  beforeEach(async () => {
    await makeTestDb();
    const r = await insertSnap({
      snapId: "snap1111",
      imageId: "imag2222",
      originalUrl: "https://blob.example.com/originals/imag2222.jpg",
      blurredUrl: "https://blob.example.com/blurred/snap1111.jpg",
      aspect: "1:1",
      createdAt: Date.now(),
    });
    if (r.isErr()) throw new Error(r.error.message);
  });

  afterEach(() => resetDb());

  it("returns originalUrl for a known image id", async () => {
    const r = await findByImageId("imag2222");
    expect(r.isOk()).toBe(true);
    if (r.isErr()) return;
    expect(r.value.originalUrl).toBe("https://blob.example.com/originals/imag2222.jpg");
  });

  it("does NOT leak snap-id ↔ image-id (cannot look up via wrong id)", async () => {
    const byImage = await findByImageId("snap1111"); // snap id ≠ image id
    expect(byImage.isErr()).toBe(true);
    if (!byImage.isErr()) return;
    expect(byImage.error.kind).toBe("not_found");
  });

  it("returns not_found for unknown id", async () => {
    const r = await findByImageId("doesnt99");
    expect(r.isErr()).toBe(true);
    if (!r.isErr()) return;
    expect(r.error.kind).toBe("not_found");
  });
});
