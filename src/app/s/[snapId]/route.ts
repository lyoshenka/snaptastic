import { NextResponse, type NextRequest } from "next/server";
import { findBySnapId } from "@/lib/db";
import { buildSnap, SNAP_MEDIA_TYPE, wantsSnapJson } from "@/lib/snap";
import { resolveBaseUrl, revealUrlFor } from "@/lib/cast";
import { errorToStatus, type AppError } from "@/lib/errors";
import type { Aspect } from "@/lib/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ snapId: string }> },
): Promise<NextResponse> {
  const { snapId } = await ctx.params;
  const accept = req.headers.get("accept");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto");
  const base = resolveBaseUrl(host, proto);

  const row = await findBySnapId(snapId);
  if (row.isErr()) return errorResponse(row.error);

  // Browser hit with Accept: text/html → redirect to reveal page so raw clicks still work.
  if (!wantsSnapJson(accept)) {
    return NextResponse.redirect(revealUrlFor(base, row.value.imageId), 302);
  }

  const snap = buildSnap({
    blurredUrl: row.value.blurredUrl,
    aspect: row.value.aspect as Aspect,
    revealUrl: revealUrlFor(base, row.value.imageId),
  });
  if (snap.isErr()) return errorResponse(snap.error);

  return new NextResponse(JSON.stringify(snap.value), {
    status: 200,
    headers: {
      "Content-Type": SNAP_MEDIA_TYPE,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
      Vary: "Accept",
    },
  });
}

function errorResponse(e: AppError): NextResponse {
  return NextResponse.json(
    { error: e.kind, message: e.message },
    { status: errorToStatus(e) },
  );
}
