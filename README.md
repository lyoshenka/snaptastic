# snaptastic

Drop an image → get a Farcaster snap that shows a blurry preview → viewers tap **View** to reveal the full image.

## How it works

1. Drag/drop or tap to upload an image on the homepage
2. The server stores the original + a blurred preview in Vercel Blob
3. A Snap URL (`/s/{snapId}`) is generated — it serves valid `application/vnd.farcaster.snap+json`
4. Click **Cast it** to open the Farcaster composer prefilled with the snap URL and caption `peek 👀`
5. Viewers see the blurred image in-feed; tapping **View** opens `/i/{imageId}` — full image, black background

The snap ID and image ID are independent random values so neither can be guessed from the other.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Vercel Blob** — image storage (original + blurred JPEG preview)
- **Turso** (libSQL + Drizzle ORM) — snap metadata
- **sharp** — blur pipeline (downscale → 64px + sigma 15 → JPEG q80)
- **@farcaster/snap v2** — snap JSON schema + validator
- **neverthrow** — all fallible ops return typed `Result<T, E>`
- **blocks.css** — UI styling
- **Tailwind CSS** — responsive layout utilities
- **Vitest** — 34 unit + route tests

## Routes

| Route | Description |
|---|---|
| `GET /` | Upload page |
| `POST /api/upload` | Multipart upload → returns `{ snapId, snapUrl, castUrl }` |
| `GET /s/[snapId]` | Farcaster snap JSON (content-negotiated; browser → redirect to reveal) |
| `GET /i/[imageId]` | Full-bleed reveal page on black background |

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # 34 tests
pnpm typecheck
pnpm build
```

## Environment variables

```bash
BLOB_READ_WRITE_TOKEN=   # Vercel Blob token
TURSO_URL=               # libsql://your-db.turso.io
TURSO_AUTH_TOKEN=        # Turso auth token
PUBLIC_BASE_URL=         # Optional; defaults to VERCEL_URL or localhost:3000
```

## Testing snaps locally

```bash
# Upload something first, then:
curl -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:3000/s/<snapId>
# Should return valid snap JSON

pnpm dlx @farcaster/snap-emulator
# Point it at http://localhost:3000/s/<snapId>
```
