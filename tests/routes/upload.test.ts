import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock @vercel/blob BEFORE importing the route.
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, _body: Buffer, _opts: unknown) => {
    // Vercel Blob inserts suffix before extension, e.g. "blurred/snap.jpg" → ".../blurred/snap-abc.jpg"
    const dot = pathname.lastIndexOf(".");
    const url =
      dot !== -1
        ? `https://blob.example.com/${pathname.slice(0, dot)}-fakesuffix${pathname.slice(dot)}`
        : `https://blob.example.com/${pathname}-fakesuffix`;
    return { url, pathname };
  }),
  del: vi.fn(async () => undefined),
}));

import sharp from "sharp";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";
import { validateSnapResponse, MEDIA_TYPE } from "@farcaster/snap";
import { GET as snapGET } from "@/app/s/[snapId]/route";
import { makeTestDb, resetDb } from "./helpers";

async function makePng(w = 800, h = 600): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
}

function formRequest(buffer: Buffer, filename = "test.png", type = "image/png"): NextRequest {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(buffer)], filename, { type }));
  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: fd,
    headers: { host: "localhost:3000" },
  });
}

describe("POST /api/upload", () => {
  beforeEach(async () => {
    await makeTestDb();
  });
  afterEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  it("uploads a valid image and returns snap + cast url", async () => {
    const png = await makePng();
    const res = await POST(formRequest(png));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { snapId: string; snapUrl: string; castUrl: string };
    expect(body.snapId).toMatch(/^[A-Za-z2-9]{8}$/);
    expect(body.snapUrl).toBe(`http://localhost:3000/s/${body.snapId}`);

    const cast = new URL(body.castUrl);
    expect(cast.host).toBe("farcaster.xyz");
    expect(cast.searchParams.get("embeds[]")).toBe(body.snapUrl);
    expect(cast.searchParams.get("text")).toBe("peek 👀");
  });

  it("rejects non-image uploads", async () => {
    const fd = new FormData();
    fd.append("file", new File(["hello"], "x.txt", { type: "text/plain" }));
    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: fd,
      headers: { host: "localhost:3000" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("the returned snap id resolves to a valid snap JSON", async () => {
    const png = await makePng(1920, 1080);
    const res = await POST(formRequest(png));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { snapId: string; snapUrl: string; castUrl: string };
    const { snapId, snapUrl } = body;
    expect(snapUrl).toContain(snapId);

    const snapReq = new NextRequest(snapUrl, {
      headers: { accept: MEDIA_TYPE, host: "localhost:3000" },
    });
    const snapRes = await snapGET(snapReq, { params: Promise.resolve({ snapId }) });
    const snapBody = await snapRes.json();
    expect(snapRes.status).toBe(200);
    const v = validateSnapResponse(snapBody);
    expect(v.valid).toBe(true);
    expect(snapBody.ui.elements.img.props.aspect).toBe("16:9");
  });
});
