# Original-file access feasibility test — 8 October 2026

## Accepted product boundary
Keep the approved detailed 640px hologram. In public UNSEEN mode, ordinary saving/screenshotting should capture the hologram, not supply the clean original. The user accepts deliberate reconstruction of a rough character from public views. Do not treat reconstruction resistance as a reason to remove character detail.

The owner chooses public UNSEEN, SEEN, or BOTH. Full artwork is intentionally downloadable in SEEN/BOTH. After project unlock, the current owner may privately access their original while public mode stays UNSEEN. During mint lock this harness blocks full artwork for ordinary owners and visitors. Previously downloaded copies cannot be revoked.

## What was built and verified
`gate.mjs` is a standalone Node HTTP handler with injected asset, session, project-state and storage adapters. It is not wired into the existing Bun viewer server. `test.mjs` starts it on loopback, sends real HTTP requests and compares authorised responses byte-for-byte with fresh, randomly generated PNG fixtures. The fixtures are created outside the repository/public directory with restricted file permissions and deleted after the run. No session token or original fixture is committed.

Run: `node experiments/original-access/test.mjs`

48 checks passed; names and scope are recorded in `results.json`. Checks cover direct unauthorised requests, cross-asset access, fabricated/expired/revoked/duplicate sessions, HEAD/Range/conditional requests, alternate/static/encoded paths, metadata, exact authorised bytes, mint lock, visibility changes, origin/CSRF checks, ownership transfer and changes during storage reads. Requests denied before file loading do not read private storage.

Private originals are resolved only by server-side registry keys. No general static file handler is provided. Original responses have no-store headers and no public object-store or signed download redirect. Knowing the original API URL does not confer permission. Fresh requests after a reveal is disabled are blocked. This does not erase prior downloads or bytes already released.

## Material limitations and remaining gates
This is a local feasibility result, not a production security approval or claim of exhaustive testing. Ownership and sessions are simulated in trusted in-memory adapters; there is no wallet login endpoint and no chain integration. State is not durable. The exact Zcash/NFT ownership protocol remains undecided.

Before deployment: implement real authenticated ownership lookup with transfer/finality handling, durable policy state, secure session issuance, private storage ACLs, and failure-closed behaviour for dependency outages. Validate deployment packaging and backups, all image transformations/thumbnails/metadata, reverse proxy/CDN caches and browser back/forward behaviour. Test ordinary mobile long-press and desktop Save Image on the actual integrated viewer. Then independently review the full implementation.

The existing public sample demos remain public and are not made secure by these tests. The owner/visitor demonstration is still a UI simulation. This directory adds an isolated prototype only and makes no change to the existing viewer server or approved visual assets.

Permissible eventual claim, subject to full integration testing: in hologram-only mode, our service does not make the original artwork available to unauthorised visitors. Do not claim impossible to copy, reconstruct, or retain after an authorised disclosure.
