# Isolated protected viewer test

This branch deploys to its own Railway project, service, domain and persistent volume. It shares no runtime, login, database, storage, environment variables or deployment with We Are the Unseen. No domain purchase is needed. The source lives on a dedicated branch of the separate hologram-test repository, not the main website repository.

This is a two-asset feasibility test, not a production marketplace or real NFT wallet system. Asset 1 is the already-public Unseen sample with the approved detailed 640px/81-frame hologram for visual and save-menu testing. It does not prove secrecy of the sample, which exists publicly elsewhere. Asset 2 is a fresh random PNG generated on the private volume at first boot; its public cover contains none of its pixels. It is the access-test fixture.

Only explicitly allowlisted HTML, JS and CSS routes are public. Originals are accessed through permission-checked endpoints. Knowing a private route is insufficient in UNSEEN mode. Public SEEN/BOTH deliberately permit original downloads. The owner session permits a private view after collection unlock. The /api/visitor routes ignore any owner session and use public permissions only. A separate browser without the owner cookie provides the independent visitor test.

The one isolated test account also operates the project lock for convenience. Production owner and administrator authority must be separate. TEST_OWNER_HASH is the SHA256 of a cryptographically random test access code. It is not a website password. Login receives the code in a POST body; optional #owner links are removed from browser history before login. The plaintext code is never committed. Sessions are random, server-stored and sent in Secure HttpOnly SameSite=Strict host-only cookies; they expire after 12 hours. Mutations require the configured exact Origin and a session CSRF token.

SQLite and the fresh fixture reside on /data, outside the public file map. Modes, sessions and collection lock persist there. Original and UI responses use no-store headers. The UI fetches originals as blobs only when allowed, revokes its displayed blob on transitions/hiding, and rechecks state on return and periodically. This cannot revoke bytes already received by an authorised viewer or erase screenshots/downloads.

Required env: PUBLIC_ORIGIN, TEST_OWNER_HASH, DATA_DIR=/data, PORT=3000. LOCAL_TEST=1 is only for loopback tests and must never be enabled on the hosted service. Docker uses Node 24 and an explicit file copy list. No dependencies or public static-directory middleware are used.

Run `node test.mjs` for the local integration checks. Hosted route tests are executed separately and recorded in the handover. Browser/phone behaviour, additional devices, failover/backups, service-worker/CDN behaviour and third-party marketplace compatibility still need verification. No real chain, wallet, ownership transfer or final production security review is implemented.

Accepted requirement: keep the detailed hologram; deliberate reconstruction from its permitted public views is an accepted limitation. Prevent direct unauthorised retrieval of the clean original. Do not present normal Save as producing the grey reconstruction diagnostic.
