import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildCastUrl, resolveBaseUrl, revealUrlFor, snapUrlFor } from "@/lib/cast";

describe("buildCastUrl", () => {
  it("targets Farcaster composer with text + embed", () => {
    const url = new URL(buildCastUrl("https://snaptastic.app/s/aB3xK9pQ"));
    expect(url.origin + url.pathname).toBe("https://farcaster.xyz/~/compose");
    expect(url.searchParams.get("text")).toBe("peek 👀");
    expect(url.searchParams.get("embeds[]")).toBe("https://snaptastic.app/s/aB3xK9pQ");
  });
});

describe("resolveBaseUrl", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.SNAPTASTIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.VERCEL_URL;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers PUBLIC_BASE_URL and strips trailing slash", () => {
    process.env.PUBLIC_BASE_URL = "https://snaptastic.app/";
    expect(resolveBaseUrl("example.com", "https")).toBe("https://snaptastic.app");
  });

  it("falls back to VERCEL_URL", () => {
    process.env.VERCEL_URL = "snaptastic-abc.vercel.app";
    expect(resolveBaseUrl(null, null)).toBe("https://snaptastic-abc.vercel.app");
  });

  it("derives from request host", () => {
    expect(resolveBaseUrl("localhost:3000", "http")).toBe("http://localhost:3000");
    expect(resolveBaseUrl("example.com", "https")).toBe("https://example.com");
  });

  it("defaults localhost to http when proto missing", () => {
    expect(resolveBaseUrl("localhost:3000", null)).toBe("http://localhost:3000");
  });
});

describe("url builders", () => {
  it("snapUrlFor + revealUrlFor use expected paths", () => {
    expect(snapUrlFor("https://a.com", "abc12345")).toBe("https://a.com/s/abc12345");
    expect(revealUrlFor("https://a.com", "xyz98765")).toBe("https://a.com/i/xyz98765");
  });
});
