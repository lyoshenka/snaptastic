import { ResultAsync } from "neverthrow";
import sharp from "sharp";
import { err, type AppError } from "./errors";

export type Aspect = "1:1" | "16:9" | "4:3" | "9:16";

const ASPECTS: Array<{ label: Aspect; ratio: number }> = [
  { label: "1:1", ratio: 1 / 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "9:16", ratio: 9 / 16 },
];

export function pickAspect(width: number, height: number): Aspect {
  if (width <= 0 || height <= 0) return "1:1";
  const r = width / height;
  let best = ASPECTS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const cand of ASPECTS) {
    // log-ratio distance handles tall + wide symmetrically
    const dist = Math.abs(Math.log(r / cand.ratio));
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }
  return best.label;
}

export type ProcessedImage = {
  original: Buffer;
  originalContentType: string;
  blurred: Buffer;
  blurredContentType: "image/jpeg";
  width: number;
  height: number;
  aspect: Aspect;
};

export function processImage(input: Buffer, declaredContentType?: string): ResultAsync<ProcessedImage, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const pipeline = sharp(input, { failOn: "error" });
      const meta = await pipeline.metadata();
      if (!meta.width || !meta.height || !meta.format) {
        throw new Error("image metadata missing width/height/format");
      }
      const aspect = pickAspect(meta.width, meta.height);

      // Blurred preview: downscale to 64px on longest edge, blur, re-encode JPEG.
      const blurred = await sharp(input)
        .rotate() // respect EXIF
        .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
        .blur(15)
        .jpeg({ quality: 80 })
        .toBuffer();

      return {
        original: input,
        originalContentType: declaredContentType ?? `image/${meta.format}`,
        blurred,
        blurredContentType: "image/jpeg" as const,
        width: meta.width,
        height: meta.height,
        aspect,
      };
    })(),
    (e) => err.image(e instanceof Error ? e.message : "sharp failed", e),
  );
}
