# Zcash integration investigation — 8 October 2026

## Decision
Use an isolated LOCAL OrchardZSA regtest first, with a generic supply-one finalized asset. Do not upload the Unseen character, hologram, traits, brand, private image, or implementation to Cachet's public registry. No mint, transfer, deployment, wallet creation or external message was performed during this investigation.

## Evidence inspected directly
- cachet-zec/cachet README.md blob eee6e93ef3b80397afc042d1047e82d0e4aa30aa
- docs/SETUP.md blob 7fbe34ac6d51dde1a273c3222f598f2ef1851b2b
- infra/docker-compose.yml blob c2eb9b00b90d7df0f3eb5185dc59ae92e72704ef
- server/crates/mint-engine/src/lib.rs
- packages/api-client/openapi.json
- server/crates/chain/tests/regtest.rs
- QED-it/zcash_tx_tool README.md blob fbf3089fbfe16a2d876b2d188889dc5ecfad0d71
- Zecbit-nft/nscv README.md blob 2dd339d3cc80fea2f03732d59ff7240c1d6b2266 and SPEC.md

These are upstream statements and code review, not locally executed chain results.

## Findings
Cachet explicitly supports a self-hosted local regtest and a separate public ZSA testnet. The local setup needs Docker, Rust >=1.86, Node22 and pnpm10. Its documented Zebra revision is f0635ce96058a598ae1e7d47435a0582057f242d, with a documented upstream workaround. Before building, pin the entire compatible source set and compare its CI workflow; do not mix unrelated latest dependencies. Local RPC/Postgres bindings in its compose are loopback-only.

Cachet's browser engine exposes issuance, local wallet scanning, transfer/burn and swap functions. Its registry has no ownership database or ownership attestation. API /wallet is the OPERATOR wallet's tracked balances, not authentication for an arbitrary visitor. No dedicated challenge-bound current-asset-holder login endpoint was found in the inspected OpenAPI or browser exports. Local wallet JSON claiming a balance is not a server-verifiable ownership proof.

Its chain integration tests include supply/finalization, rejected reissue, transfer/burn and finalized supply-one batch cases. QEDIT also documents issue/transfer/burn scenarios, but expressly says its transaction tool is not a production wallet. This gives us a reproducible chain-lifecycle candidate, not a finished NFT-gated-login solution.

The NSCV alternative uses Orchard notes plus consignments and full viewing keys and says the real crypto/node backends must be supplied. Its bundled fake backends are not Orchard. It is unaudited, imposes special account/coin-selection/transfer constraints, and discloses historical viewing material. Its README's comparison table says ZSA ownership is public, conflicting with Cachet/protocol descriptions of shielded transfers; do not rely on that comparison.

Important independent authentication inference: possession of a disclosed viewing key/consignment alone does not establish spending authority. Someone can copy disclosed viewing material. A CURRENTLY_HELD result for a note is not by itself proof the caller is its exclusive controlling holder. Any adapted login must bind a fresh challenge to authority over the actual note, asset and application, and independently check unspent/current chain state. Do not deploy a view-key-only shortcut or collect users' general wallet viewing/spending keys.

## Candidate next steps
1. On a private machine, run the pinned local chain and reproduce finalized supply-one issuance and A-to-B transfer with generic material. Keep browser wallets local, public registry/notifications disabled, local server bound to loopback.
2. Inspect/design the ownership proof separately: binding of asset ID, confirmed membership, unspent status, caller control, application origin, nonce and expiry. Verify whether existing OrchardZSA components can supply it without custom unaudited cryptography. A server-trusted test-wallet agent is only a laboratory bridge, not noncustodial production verification.
3. Reproduce outsider, former-owner, copied viewing data, stale-proof, replay, outside-market transfer, outage and reorg failures before exposing any real artwork.
4. Then integrate the verified proof with the existing access gate. Record confirmation policy and revocation delay. No previously delivered image can be revoked.

## Execution limitation
This workspace has Node, but docker/cargo/rustc were not found on PATH and there is no /var/run/docker.sock. The real regtest has NOT been launched. A suitable private build/runtime environment is needed. The user's Windows laptop with Docker Desktop is a potential option; verify availability first rather than tell them a test has already run. No user wallet action is needed during research.

## Source URLs
https://github.com/cachet-zec/cachet
https://github.com/cachet-zec/cachet/blob/main/docs/SETUP.md
https://github.com/cachet-zec/cachet/blob/main/server/crates/mint-engine/src/lib.rs
https://github.com/cachet-zec/cachet/blob/main/packages/api-client/openapi.json
https://github.com/QED-it/zcash_tx_tool
https://github.com/Zecbit-nft/nscv
https://zips.z.cash/zip-0226
