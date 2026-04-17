const CAST_CAPTION = "peek 👀";
const COMPOSER = "https://farcaster.xyz/~/compose";

export function buildCastUrl(snapUrl: string, text: string = CAST_CAPTION): string {
  const params = new URLSearchParams();
  params.set("text", text);
  // embeds[] is an array param; URLSearchParams handles the bracket literally.
  params.append("embeds[]", snapUrl);
  return `${COMPOSER}?${params.toString()}`;
}

export function resolveBaseUrl(host?: string | null, proto?: string | null): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (host) {
    const scheme = proto ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${scheme}://${host}`;
  }
  return "http://localhost:3000";
}

export function snapUrlFor(baseUrl: string, snapId: string): string {
  return `${baseUrl}/s/${snapId}`;
}

export function revealUrlFor(baseUrl: string, imageId: string): string {
  return `${baseUrl}/i/${imageId}`;
}
