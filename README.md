# Ownership handover checkpoint — 8 October 2026

## Status
23 local model checks passed. This is NOT Zcash ownership verification, NOT a wallet integration, and NOT deployed. The approved hosted hologram viewer remains unchanged. Run `node test.mjs` using Node with Ed25519 support.

The test generates two ephemeral Ed25519 identities, signs application-specific nonce challenges and uses a deliberately simulated ownership authority. No real keys, funds, NFTs or transfers are involved. The authority supplies current owner and ownership revision; neither exists as a public owner lookup for a shielded asset in this implementation. The proof-to-authority mapping is the unresolved integration task.

## What was checked
Current holder access; outsider denial; asset scoping; forged sessions; wrong-key signatures; single-use and expiring challenges; public reveal; transfer revocation of existing sessions and outstanding challenges; new holder access; outage/stale/uncertain-state denial; return transfer not reviving old sessions; logout and expiry.

Proposed transfer policy: each ownership change resets public reveal to off. This is a design default for review, not yet a user-approved production rule. Already downloaded images remain with their recipients. Revocation governs new requests after the verifier recognizes the transfer, not already delivered bytes or in-flight responses. A real integration needs explicit finality, freshness and maximum revocation delay rules.

## What this model does not prove
No Zcash proof generation or verification; no actual NFT uniqueness/provenance verification; no real on-chain transfers; no reorg integration; no browser wallet compatibility; no persistent session/challenge storage; no HTTP/CSRF/rate-limit wrapper; no multi-process race/transaction treatment; no production key management. The model's synchronous authority is artificial. Its ten-second freshness and five-minute sessions are laboratory parameters, not researched production guarantees. Map storage is unbounded and unsuitable for a public endpoint.

## Research checkpoint
Primary sources reviewed on 8 October 2026:
- https://github.com/cachet-zec/cachet — issuance and verifiable registry on the ZSA testnet; describes shielded balances/transfers. Does not establish a ready-made compatible ownership-login interface for this viewer.
- https://zips.z.cash/zip-0226 — shielded asset transfer/burn protocol and nullifiers. Protocol support alone is not an application ownership proof.
- https://zips.z.cash/zip-0227 — issuance protocol.
- https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/409 — ZecBit grant proposal; candidate tooling to evaluate, not proof its proposed integration is deployed or audited.

Next real integration gate: identify a specific NFT representation and compatible wallet, then demonstrate a proof that is bound to the asset, challenge, application and current unspent ownership. Check its disclosure to the verifier, and how transfers outside our marketplace revoke old access. Ordinary wallet signatures only establish control of a key and must not be labelled ownership proof. Do not request spending keys or seed phrases, or publish a plaintext original/traits bundle in metadata.

Acceptance sequence for an actual testnet adapter: issue one unique test asset, obtain owner A's proof without private spending keys leaving the wallet, authorize A, deny B, transfer to B using the chain, deny A's existing session and old proof after the chosen finality boundary, authorize B, repeat on verifier outage and chain uncertainty. Record measured revocation delay and privacy disclosures. Only then connect the adapter to a separately hosted test viewer.

## User testing already completed on existing hosted viewer
User confirmed Android hologram-only save; private owner original with public UNSEEN; public reveal and saving full yellow original; reverting to UNSEEN and HTTP 403; separate signed-out desktop private window HTTP 403 and hologram-only right-click save. These establish tested viewer behaviour, not cryptographic NFT ownership. The UI dropdown reset bug was fixed in commit b4d524800d9fc683ff456d9f8f60f95fecfbdd25.

The intended marketplace UI is one reveal-permission on/off switch plus a separate private owner view. The current diagnostic page is only for testing. Everything remains separate from the We Are the Unseen website.
