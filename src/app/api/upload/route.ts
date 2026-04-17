import { NextResponse, type NextRequest } from "next/server";
import { ResultAsync } from "neverthrow";
import { newIdPair } from "@/lib/ids";
import { processImage } from "@/lib/image";
import { putBlob } from "@/lib/blob";
import { insertSnap } from "@/lib/db";
import { buildCastUrl, resolveBaseUrl, snapUrlFor } from "@/lib/cast";
import { err, errorToStatus, type AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await parseForm(req)
    .andThen(({ file, buffer }) => processImage(buffer, file.type).map((img) => ({ file, img })))
    .andThen(({ img }) => {
      const { snapId, imageId } = newIdPair();
      const origExt = img.originalContentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const origPath = `originals/${imageId}.${origExt}`;
      const blurPath = `blurred/${snapId}.jpg`;
      return ResultAsync.combine([
        putBlob(origPath, img.original, img.originalContentType),
        putBlob(blurPath, img.blurred, img.blurredContentType),
      ]).map(([original, blurred]) => ({ snapId, imageId, img, original, blurred }));
    })
    .andThen(({ snapId, imageId, img, original, blurred }) =>
      insertSnap({
        snapId,
        imageId,
        originalUrl: original.url,
        blurredUrl: blurred.url,
        aspect: img.aspect,
        createdAt: Date.now(),
      }).map(() => ({ snapId, imageId })),
    );

  return result.match(
    ({ snapId }) => {
      const host = req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto");
      const base = resolveBaseUrl(host, proto);
      return NextResponse.json({
        snapId,
        snapUrl: snapUrlFor(base, snapId),
        castUrl: buildCastUrl(snapUrlFor(base, snapId)),
      });
    },
    (e) => errorResponse(e),
  );
}

function parseForm(req: NextRequest): ResultAsync<{ file: File; buffer: Buffer }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("missing `file` field");
      if (!file.type.startsWith("image/")) throw new Error(`not an image: ${file.type}`);
      if (file.size > MAX_BYTES) throw new Error(`file too large: ${file.size} bytes`);
      const ab = await file.arrayBuffer();
      return { file, buffer: Buffer.from(ab) };
    })(),
    (e) => err.upload(e instanceof Error ? e.message : "form parse failed", e),
  );
}

function errorResponse(e: AppError): NextResponse {
  return NextResponse.json({ error: e.kind, message: e.message }, { status: errorToStatus(e) });
}

