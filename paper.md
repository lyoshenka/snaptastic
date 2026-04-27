# Paper (née Snaptastic) — Pay-Per-Snap

## Context

Add a paywall to snaps. Every snap starts locked. Viewer pays 1 USDC on Base to a configured payment address, taps "I paid" which POSTs their FID via JFS to the server, and the server issues a signed short-lived JWT. The snap then shows an "Open unlock page" button that opens a web page using that JWT. The page polls our API — first checking the DB, then querying Neynar + Base if needed — and automatically shows the image once the tx is confirmed. Subsequent visits (with same token or after payment is in DB) skip the chain query entirely.

The FID is always cryptographically bound: it comes from the JFS-verified submit, not from URL params.

---

## Snap UX state machine

```
GET /s/[snapId]
  → paywall snap:
      [blurred image]
      [Pay $1]   send_token → PAYMENT_ADDRESS, 1 USDC, Base
      [I paid]   submit     → POST /s/[snapId]/initiate

POST /s/[snapId]/initiate  (JFS-signed)
  → already paid in DB?
      YES → reveal snap: [blurred image] [View] open_url → /i/[imageId]
      NO  → generate JWT({fid, imageId, exp: now+15min})
           → token snap: [blurred image] [Open unlock page] open_url → /unlock/[snapId]?token=<jwt>

GET /unlock/[snapId]?token=<jwt>  (web page, client-side polling)
  → decode + verify JWT → {fid, imageId}
  → already paid in DB (GET /api/check-payment?token=<jwt>)?
      YES → show full image immediately
      NO  → show "Waiting for payment…" UI, poll every 5s

GET /api/check-payment?token=<jwt>
  → verify JWT
  → check payments table: (fid, imageId) exists? → { paid: true, originalUrl }
  → not paid: getVerifiedAddresses(fid) → findRecentUsdcTransfer(...) 
  → if tx found: insertPayment → { paid: true, originalUrl }
  → if not: { paid: false }
```

---

## New env vars

```
NEYNAR_API_KEY=          # FID → verified ETH addresses
PAYMENT_ADDRESS=         # Base address to receive USDC (0x...)
SNAP_PRICE_USDC=1.00     # price per unlock
BASE_RPC_URL=https://mainnet.base.org   # optional override
JWT_SECRET=              # random 32-byte hex, for signing unlock tokens
```

---

## New DB table (add to ensureSchema in db.ts)

```sql
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  fid          INTEGER NOT NULL,
  image_id     TEXT NOT NULL,
  tx_hash      TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  amount_raw   TEXT NOT NULL,
  paid_at      INTEGER NOT NULL,
  UNIQUE(fid, image_id)
)
```

- `UNIQUE(fid, image_id)` — one payment per user per image
- `UNIQUE(tx_hash)` — replay protection (same tx can't unlock two images)

---

## New lib files

### `src/lib/neynar.ts`
```ts
// getVerifiedAddresses(fid: number): ResultAsync<string[], AppError>
// GET https://api.neynar.com/v2/farcaster/user?fid=<fid>
// header: x-api-key: process.env.NEYNAR_API_KEY
// returns deduped lowercase array of:
//   [...user.verified_addresses.eth_addresses, user.custody_address]
```

### `src/lib/base.ts`
```ts
// findRecentUsdcTransfer(
//   fromAddresses: string[],
//   toAddress: string,
//   windowSecs: number
// ): ResultAsync<{ txHash: string; from: string; amountRaw: bigint } | null, AppError>
//
// 1. POST BASE_RPC_URL → eth_blockNumber → currentBlock (hex → number)
// 2. fromBlock = currentBlock - Math.ceil(windowSecs / 2)  (~2s/block on Base)
// 3. POST BASE_RPC_URL → eth_getLogs:
//    { address: USDC_BASE, topics: [TRANSFER_SIG, null, pad32(toAddress)],
//      fromBlock: hex(fromBlock), toBlock: "latest" }
// 4. Filter: topics[1] (from, padded) normalised to address in fromAddresses set
// 5. Decode log.data as uint256 bigint (amountRaw)
// 6. Sort by blockNumber desc, return first match (or null)
//
// USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
// TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

### `src/lib/unlock-token.ts`
```ts
// Lightweight JWT using Web Crypto (no extra dep):
//   header.payload.sig, HMAC-SHA256 with JWT_SECRET
//
// signUnlockToken({ fid, imageId }): string
//   payload: { fid, imageId, exp: Math.floor(Date.now()/1000) + 900 }
//
// verifyUnlockToken(token: string): Result<{ fid: number; imageId: string }, AppError>
//   → check sig, check exp, return payload
```

### `src/lib/payment.ts`
```ts
// checkAndRecordPayment(fid, imageId, db):
//   ResultAsync<{ originalUrl: string }, AppError>
//
// 1. findPayment(fid, imageId) → if found, findByImageId(imageId) → return ok(originalUrl)
// 2. getVerifiedAddresses(fid)
// 3. findRecentUsdcTransfer(addresses, PAYMENT_ADDRESS, 600)
//    → null: return err({ kind: "payment_not_found" })
// 4. validate amountRaw >= 1_000_000n (1 USDC, 6 decimals)
// 5. insertPayment({ id: newId(), fid, imageId, txHash, fromAddress, amountRaw: amountRaw.toString(), paidAt: Date.now() })
//    → UNIQUE(fid,image_id) conflict: fetch existing, treat as already paid (idempotent)
//    → UNIQUE(tx_hash) conflict: err({ kind: "tx_already_used" })
// 6. findByImageId(imageId) → return ok(originalUrl)
```

---

## New error kinds (errors.ts)

```ts
| { kind: "payment_not_found"; message: string }   // → 402
| { kind: "tx_already_used"; message: string }      // → 409
| { kind: "invalid_token"; message: string }        // → 401
```

---

## New/modified snap builder functions (snap.ts)

```ts
buildPaywallSnap({ blurredUrl, aspect, initiateUrl, price }): SnapResponse
// [blurred image]
// [Pay $X]   send_token { token: USDC/Base, amount: price, recipientAddress: PAYMENT_ADDRESS }
// [I paid]   submit { action: "submit", params: { target: initiateUrl } }

buildTokenSnap({ blurredUrl, aspect, unlockPageUrl }): SnapResponse
// [blurred image]
// [Open unlock page]   open_url { target: unlockPageUrl }   variant: primary

buildRevealSnap({ blurredUrl, aspect, revealUrl }): SnapResponse
// [blurred image]
// [View]   open_url { target: revealUrl }   variant: primary
// (unchanged from current buildSnap, just renamed)

buildErrorSnap({ blurredUrl, aspect, message, retryUrl }): SnapResponse
// [blurred image]
// text element: message
// [Try again]   submit { target: retryUrl }
```

---

## New/modified routes

### GET /s/[snapId] (modified)
Use `buildPaywallSnap` instead of `buildSnap`.
Pass `initiateUrl = ${base}/s/${snapId}/initiate`.

### POST /s/[snapId]/initiate (new)
`src/app/s/[snapId]/initiate/route.ts`

```
1. Read raw body as text
2. verifyJFSRequestBody(JSON.parse(body)) from "@farcaster/snap/server"
   → invalid: return buildErrorSnap("Authentication failed", retryUrl=initiateUrl)
3. fid = result.signingUserFid
4. findBySnapId(snapId) → imageId
5. findPayment(fid, imageId) → if found: return buildRevealSnap(revealUrl=/i/[imageId])
6. token = signUnlockToken({ fid, imageId })
7. return buildTokenSnap({ unlockPageUrl: `${base}/unlock/${snapId}?token=${token}` })

Response: Content-Type: application/vnd.farcaster.snap+json, CORS *, no cache
```

### GET /unlock/[snapId] (new web page)
`src/app/unlock/[snapId]/page.tsx` — client component

```
- Reads ?token from URL
- On mount: fetch /api/check-payment?token=<token>
  → { paid: true, originalUrl } → show full image (full-bleed black, same as /i/[imageId])
  → { paid: false } → show "Waiting for payment…" + spinner, poll every 5s
  → error → show "Token invalid or expired. Go back to the snap and tap I paid again."
- Stops polling after 10 minutes (120 polls) with "Timed out" message
```

### GET /api/check-payment (new)
`src/app/api/check-payment/route.ts`

```
1. token = searchParams.get("token")
2. verifyUnlockToken(token) → { fid, imageId }
   → invalid: return 401 { error: "invalid_token" }
3. checkAndRecordPayment(fid, imageId)
   → ok: return 200 { paid: true, originalUrl }
   → payment_not_found: return 200 { paid: false }
   → tx_already_used: return 409 { error: "tx_already_used" }
   → other: return 500

Cache-Control: no-store
```

---

## File changes summary

| File | Change |
|---|---|
| `src/lib/errors.ts` | Add 3 new error kinds + status mappings |
| `src/lib/db.ts` | Add `payments` table schema + `insertPayment`, `findPayment(fid,imageId)` queries |
| `src/lib/snap.ts` | Add `buildPaywallSnap`, `buildTokenSnap`, `buildErrorSnap`; rename `buildSnap` → `buildRevealSnap` |
| `src/lib/neynar.ts` | New |
| `src/lib/base.ts` | New |
| `src/lib/unlock-token.ts` | New |
| `src/lib/payment.ts` | New |
| `src/app/s/[snapId]/route.ts` | Use `buildPaywallSnap` |
| `src/app/s/[snapId]/initiate/route.ts` | New POST handler |
| `src/app/unlock/[snapId]/page.tsx` | New polling web page |
| `src/app/api/check-payment/route.ts` | New GET handler |
| `.env.example` | Add 5 new vars |
| `tests/lib/neynar.test.ts` | New — mock fetch, verify address extraction |
| `tests/lib/base.test.ts` | New — mock RPC, verify log filtering + amount decode |
| `tests/lib/payment.test.ts` | New — mock neynar + base + db, happy path + already paid + not found + replay |
| `tests/routes/initiate.test.ts` | New — mock JFS verify, test snap states |
| `tests/routes/check-payment.test.ts` | New — mock payment lib, test 200/401/409 |

---

## Rename project to "Paper"

After the payment feature is complete and deployed, rename everything:

| Thing | From | To |
|---|---|---|
| Directory | `/Users/grin/tmp/snaptastic` | `/Users/grin/tmp/paper` |
| GitHub repo | `lyoshenka/snaptastic` | `lyoshenka/paper` (via GitHub settings → rename) |
| `package.json` `name` | `snaptastic` | `paper` |
| `README.md` title + all references | snaptastic | Paper |
| `src/app/layout.tsx` `<title>` | `snaptastic — peek 👀` | `paper` |
| `src/app/page.tsx` `<h1>` | `snaptastic` | `paper` |
| Vercel project name | `snaptastic` | `paper` (via `vercel project rename paper --scope external-mini-apps`) |
| Deployment domain | `snaptastic.host.neynar.app` | `paper.host.neynar.app` |
| `SNAPTASTIC_BASE_URL` env var | value + name | rename to `APP_BASE_URL`, value `https://paper.host.neynar.app` |
| Git remote URL | `git@github.com:lyoshenka/snaptastic.git` | `git@github.com:lyoshenka/paper.git` |
| Memory files | update project_deploy.md | new URL/project name |

---

## Verification

1. `pnpm test` — all green including new payment + initiate + check-payment tests
2. `pnpm typecheck` — clean
3. Manual happy path:
   - Upload image → open snap in emulator → tap "Pay $1" (wallet opens) → pay 1 USDC on Base → tap "I paid" → snap shows "Open unlock page" → tap → web page opens → "Waiting for payment…" → page polls → tx found → image appears full-bleed
4. Already paid: tap "I paid" again → snap shows View button directly (DB hit)
5. Tap "I paid" before paying → snap returns "I paid" → web page opens → polling times out → "No payment found"
6. Replay: same tx on two images → second attempt returns 409 error snap
7. Expired token: wait 15 min → tap unlock page link → "Token invalid or expired" message
