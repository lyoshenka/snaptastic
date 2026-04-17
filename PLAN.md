# Snaptastic — Peek-a-boo Image Snaps

## Context

Build a single-page Next.js app where users drag/drop or click to upload an image, then get a button that opens the Farcaster cast composer prefilled with a Snap URL. The Snap renders a blurred preview of the image with a "View" button that opens the full image in a new tab.

A **Snap** (per https://docs.farcaster.xyz/snap) is NOT HTML meta tags — it is a JSON document served with `Content-Type: application/vnd.farcaster.snap+json` describing a tree of UI elements. Our server returns that JSON; the Farcaster client renders it.

Security requirement from user: the snap-id (exposed in casts) and image-id (exposed only after "View" is clicked) must be independent random ids so neither can be guessed from the other.

## Tech stack

- **Runtime:** Next.js 15 (App Router), TypeScript, PNPM, Vercel hosting
- **Styling:** Tailwind CSS + [blocks.css](https://github.com/thesephist/blocks.css) (import the CDN stylesheet; Tailwind only for layout/responsive utilities)
- **Storage:** Vercel Blob (`@vercel/blob`) — public-read, random suffix on path
- **Database:** Turso (libSQL) via `@libsql/client` + Drizzle ORM
- **Image processing:** `sharp` (pre-generate blurred variant at upload)
- **Snap schema/validation:** `@farcaster/snap` v2 — use its Zod schemas to validate the JSON we emit
- **Error handling:** `neverthrow` — every fallible op returns `Result<T, E>` with typed error unions; route handlers convert Result → HTTP response at the edge
- **Testing:** Vitest — unit tests for lib (id gen, blur, snap-builder, db queries with in-memory libSQL) + route handler tests (`POST /api/upload`, `GET /s/[id]`, `GET /i/[id]`) with mocked Blob

## Architecture & routes

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Upload page: dropzone, file picker, alert-dialog errors. Responsive (mobile + desktop). |
| `/api/upload` | POST | Multipart form upload → sharp → Blob × 2 (original + blurred) → DB insert → returns `{ snapId, castUrl }` |
| `/s/[snapId]` | GET | Content-negotiated: if `Accept: application/vnd.farcaster.snap+json` → snap JSON; else a minimal HTML redirect to `/i/[imageId]` (so a raw browser hit still works) |
| `/i/[imageId]` | GET | Full-bleed reveal page on black background. Server component reads DB, renders `<img>` with `object-fit: contain`. |

### Snap JSON shape returned from `/s/[snapId]`

```json
{
  "version": "2.0",
  "theme": { "accent": "amber" },
  "ui": {
    "root": "page",
    "elements": {
      "page":  { "type": "stack",  "props": {}, "children": ["img", "btn"] },
      "img":   { "type": "image",  "props": { "url": "<blurred blob url>", "aspect": "<auto 1:1|16:9|4:3|9:16>" } },
      "btn":   { "type": "button", "props": { "label": "View", "variant": "primary" },
                 "on": { "press": { "action": "open_url",
                                    "params": { "target": "https://<host>/i/<imageId>" } } } }
    }
  }
}
```

Headers: `Content-Type: application/vnd.farcaster.snap+json`, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=60, stale-while-revalidate=3600`. Response is schema-validated via `@farcaster/snap` before sending.

### Upload → cast flow (client)

1. User drops image on `/`.
2. Client-side MIME/size pre-check (≤10 MB, any sharp-accepted type), then `POST /api/upload` multipart.
3. Server: validate → read buffer → `sharp(buf).metadata()` → pick nearest aspect of `{1:1, 16:9, 4:3, 9:16}` → produce **blurred variant**: downscale to 64px longest edge + `sharp.blur(15)` + re-encode JPEG q80 → upload both to Vercel Blob (`originals/{nanoid}` + `blurred/{nanoid}`) → insert row → return `{ snapId, castUrl }`.
4. `castUrl` = `https://farcaster.xyz/~/compose?text=${encodeURIComponent("peek 👀")}&embeds[]=${encodeURIComponent("https://<host>/s/<snapId>")}`.
5. UI swaps dropzone for a big "Cast it" button that opens `castUrl` in a new tab. No preview.

## Data model (Turso + Drizzle)

```ts
snaps:
  snap_id      TEXT PK           // nanoid(8), url-safe alphabet
  image_id     TEXT UNIQUE       // nanoid(8), independent entropy — not derivable from snap_id
  original_url TEXT              // Vercel Blob public URL (full image)
  blurred_url  TEXT              // Vercel Blob public URL (blurred preview)
  aspect       TEXT              // '1:1' | '16:9' | '4:3' | '9:16'
  created_at   INTEGER           // unix ms
```

Two independent nanoids generated per upload. `snap_id` is looked up on `/s/[snapId]` and returns `image_id` + `blurred_url`. `image_id` is looked up on `/i/[imageId]` and returns `original_url`. Neither endpoint ever exposes the other id.

Retention: forever (no TTL, no cron).

## File layout

```
snaptastic/
├── package.json                  # pnpm, "packageManager": "pnpm@9.x"
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── drizzle.config.ts
├── vitest.config.ts
├── .env.example                  # BLOB_READ_WRITE_TOKEN, TURSO_URL, TURSO_AUTH_TOKEN, PUBLIC_BASE_URL
├── src/
│   ├── app/
│   │   ├── layout.tsx            # imports blocks.css via CDN <link>, Tailwind globals
│   │   ├── globals.css
│   │   ├── page.tsx              # "/" upload client component (dropzone + alert dialog)
│   │   ├── s/[snapId]/route.ts   # GET returning snap JSON (content-negotiated)
│   │   ├── i/[imageId]/page.tsx  # reveal page, full-bleed black bg
│   │   └── api/upload/route.ts   # POST multipart upload
│   ├── lib/
│   │   ├── ids.ts                # nanoid(8) for snapId/imageId with collision retry
│   │   ├── blob.ts               # Result-typed wrapper around @vercel/blob put/del
│   │   ├── db.ts                 # drizzle client + schema + Result-typed queries
│   │   ├── image.ts              # sharp pipeline: metadata → aspect pick → blur
│   │   ├── snap.ts               # buildSnap(): returns validated SnapResponse via @farcaster/snap schema
│   │   ├── cast.ts               # buildCastUrl(snapId): composer URL
│   │   └── errors.ts             # discriminated-union error types for neverthrow
│   └── components/
│       ├── Dropzone.tsx          # drag/drop + click-to-pick, responsive
│       └── AlertDialog.tsx       # simple modal for error surfaces
├── drizzle/                      # migrations
└── tests/
    ├── lib/
    │   ├── image.test.ts         # aspect picker, blur output shape
    │   ├── snap.test.ts          # generated JSON validates against @farcaster/snap schema
    │   └── cast.test.ts
    └── routes/
        ├── upload.test.ts        # mocks @vercel/blob + drizzle
        ├── snap-route.test.ts    # content-negotiation, CORS, cache headers
        └── reveal.test.ts
```

## Key implementation notes

- **neverthrow everywhere:** wrap `sharp`, `@vercel/blob`, libSQL, `fetch`, and `@farcaster/snap` validate calls in `ResultAsync.fromPromise` / `Result.fromThrowable`. Define a union `AppError = UploadError | StorageError | DbError | ImageError | ValidationError | NotFoundError` in `lib/errors.ts`. Route handlers call `.match(ok → NextResponse.json, err → errorResponse(err))`.
- **Aspect picker** (`lib/image.ts`): given source `w,h`, compute ratio and return the candidate from `[1/1, 16/9, 4/3, 9/16]` with smallest `|log(sourceRatio/candidate)|`.
- **ID independence:** two separate `nanoid(8)` calls per upload from `customAlphabet` (url-safe). Collisions retried ≤3× against DB unique constraint. Never hash or derive image-id from snap-id.
- **Content negotiation on `/s/[snapId]`:** parse `Accept`; if it includes `application/vnd.farcaster.snap+json` (or `*/*`) → snap JSON. If it explicitly prefers `text/html` → 302 to `/i/[imageId]` so raw browser clicks still reveal the image (optional; confirm on review).
- **blocks.css:** add `<link rel="stylesheet" href="https://unpkg.com/blocks.css/dist/blocks.min.css">` in `app/layout.tsx`. Use its `.block` / button / input classes. Tailwind layers on for responsive utilities (`sm:`, `md:`) and layout.
- **Responsive:** single-column on mobile; dropzone fills width with generous padding. Desktop: centered max-w-2xl. Drag-drop listeners + touch-friendly file picker (`<input type="file" accept="image/*" capture>`).
- **Cast composer URL:** `https://farcaster.xyz/~/compose?text=peek%20%F0%9F%91%80&embeds[]=<encoded snap url>`.
- **Reveal page `/i/[imageId]`:** server component, `<body class="bg-black">`, `<img src={originalUrl} class="max-w-full max-h-screen object-contain mx-auto">`. No chrome, no footer. 404 → simple "snap not found" black page.
- **Env resolution:** `PUBLIC_BASE_URL` in prod; derive from `VERCEL_URL` if unset; `http://localhost:3000` locally. Used when building snap-URL and reveal-URL.

## Critical files to create

- `src/app/api/upload/route.ts` — POST handler, primary server logic
- `src/app/s/[snapId]/route.ts` — snap JSON endpoint (must be schema-valid)
- `src/app/i/[imageId]/page.tsx` — reveal page
- `src/app/page.tsx` — upload UI
- `src/lib/snap.ts`, `src/lib/image.ts`, `src/lib/db.ts`, `src/lib/blob.ts`, `src/lib/ids.ts`

## Reused libraries / utilities (no reinvention)

- `@farcaster/snap` — Zod schemas & types for the Snap JSON (do not hand-roll types)
- `@vercel/blob` — `put({access:"public"})`, `del()`
- `sharp` — metadata, resize, blur, toBuffer
- `nanoid` — secure nanoid from `nanoid` pkg (url-safe `customAlphabet`)
- `drizzle-orm` + `@libsql/client`
- `neverthrow` — `Result`, `ResultAsync`, `ok`, `err`, `fromPromise`

## Verification

1. `pnpm install && pnpm build` — clean build, no TS errors.
2. `pnpm test` — all Vitest tests green (lib + route tests).
3. **Manual local (after `pnpm dev` on :3000):**
   - Drop a JPEG → see "Cast it" button appear → click → new tab opens `farcaster.xyz/~/compose?...` with caption `peek 👀` and embed URL populated.
   - `curl -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:3000/s/<snapId>` → valid JSON, content-type `application/vnd.farcaster.snap+json`, passes `@farcaster/snap` schema validation.
   - Visit `/s/<snapId>` in browser (Accept: text/html) → lands on reveal page (or see snap JSON, depending on negotiation choice).
   - Visit `/i/<imageId>` → full original image, black background, no chrome.
   - Upload 11 MB file → alert dialog with error, no request sent / rejected.
   - Upload non-image → alert dialog error.
4. **Snap emulator:** run `pnpm dlx @farcaster/snap-emulator` (or the monorepo's emulator) and point it at `http://localhost:3000/s/<snapId>` — confirm image renders blurred with a "View" button that opens a new tab to the reveal page.
5. **Mobile responsive:** Chrome DevTools iPhone viewport — dropzone fills width, tap-to-pick works, "Cast it" button hits target size ≥44px.
6. **Deploy:** `vercel --prod`, set `BLOB_READ_WRITE_TOKEN` + Turso env. Re-run curl verification against prod URL.
7. **ID-independence spot check:** upload two images, confirm `snapId` and `imageId` for the same upload share no prefix/derivation; manually swap one into the other's URL → 404.
