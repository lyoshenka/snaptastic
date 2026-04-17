import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/s/[snapId]/route";
import { NextRequest } from "next/server";
import { insertSnap } from "@/lib/db";
import { validateSnapResponse, MEDIA_TYPE } from "@farcaster/snap";
import { makeTestDb, resetDb } from "./helpers";

describe("GET /s/[snapId]", () => {
  beforeEach(async () => {
    await makeTestDb();
    const r = await insertSnap({
      snapId: "snap1234",
      imageId: "imag5678",
      originalUrl: "https://blob.example.com/originals/imag5678-abc.jpg",
      blurredUrl: "https://blob.example.com/blurred/snap1234-xyz.jpg",
      aspect: "16:9",
      createdAt: Date.now(),
    });
    if (r.isErr()) throw new Error(r.error.message);
  });

  afterEach(() => resetDb());

  it("returns a schema-valid snap JSON with correct headers", async () => {
    const req = new NextRequest("http://localhost:3000/s/snap1234", {
      headers: { accept: MEDIA_TYPE, host: "localhost:3000" },
    });
    const res = await GET(req, { params: Promise.resolve({ snapId: "snap1234" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(MEDIA_TYPE);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("max-age=60");

    const json = await res.json();
    const v = validateSnapResponse(json);
    expect(v.valid).toBe(true);
    expect(json.ui.elements.img.props.url).toBe("https://blob.example.com/blurred/snap1234-xyz.jpg");
    expect(json.ui.elements.btn.on.press.params.target).toBe("http://localhost:3000/i/imag5678");
  });

  it("redirects to reveal page for html requests", async () => {
    const req = new NextRequest("http://localhost:3000/s/snap1234", {
      headers: { accept: "text/html", host: "localhost:3000" },
    });
    const res = await GET(req, { params: Promise.resolve({ snapId: "snap1234" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/i/imag5678");
  });

  it("404s on unknown snapId", async () => {
    const req = new NextRequest("http://localhost:3000/s/nope0000", {
      headers: { accept: MEDIA_TYPE, host: "localhost:3000" },
    });
    const res = await GET(req, { params: Promise.resolve({ snapId: "nope0000" }) });
    expect(res.status).toBe(404);
  });
});
