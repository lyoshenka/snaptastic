import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { pickAspect, processImage } from "@/lib/image";

describe("pickAspect", () => {
  it.each([
    [1000, 1000, "1:1"],
    [1920, 1080, "16:9"],
    [1080, 1920, "9:16"],
    [800, 600, "4:3"],
    [600, 800, "9:16"], // 3:4 is closest to 9:16 on log scale
    [2000, 1400, "4:3"],
  ])("(%ix%i) → %s", (w, h, expected) => {
    expect(pickAspect(w, h)).toBe(expected);
  });

  it("defaults to 1:1 on zero dims", () => {
    expect(pickAspect(0, 0)).toBe("1:1");
  });
});

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe("processImage", () => {
  it("produces blurred jpeg and picks aspect", async () => {
    const input = await makePng(640, 480);
    const result = await processImage(input, "image/png");
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.aspect).toBe("4:3");
    expect(result.value.width).toBe(640);
    expect(result.value.height).toBe(480);
    expect(result.value.blurredContentType).toBe("image/jpeg");
    // Blurred is a valid JPEG whose longest edge is ≤64px.
    const meta = await sharp(result.value.blurred).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(300);
  });

  it("errors on garbage input", async () => {
    const result = await processImage(Buffer.from("not an image"), "image/png");
    expect(result.isErr()).toBe(true);
  });
});
