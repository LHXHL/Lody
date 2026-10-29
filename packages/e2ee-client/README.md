# Personal-device client host

[中文](README.zh.md)

`@lody/e2ee-client` is opt-in, platform-neutral product composition over
`@lody/e2ee-core`. It contains no Node, Electron, filesystem, SQLite, default
account or cloud endpoint. Desktop consumes the shared pairing codecs,
full-history verifier and finite key-maintenance owner; its existing native
storage and product assembly remain in place.

## Acquire and own

Build `makePersonalDeviceHost()` in a Scope with `PersonalHostPlatform`,
`PersonalHostRemote`, `ClientInstallationStore`, `ClientCustodyWriter` and
`ClientPairingOriginalStore`. Capture one account/workspace/independently pinned
genesis. A capability captures the same complete binding; another account's login
or a response label never chooses it. Missing support fails explicitly.

The platform supplies persistent custody, ledger ports, key stores/backends,
public approval evidence and optional immutable RPC originals. Browser composition
can use the existing browser-crypto/browser-custody and IndexedDB adapters;
mobile supplies the same narrow custody shape with real native lifetime handling.
Factories receive a borrowed credential valid only in their owning Scope. Their
finalizers must abort/drain actual calls before release. They cannot replace the
host's fixed identity, verifier or installed/candidate protectors through extra
Layer outputs. The host returns neither private keys, credentials nor a generic
signing capability.

- `prepare(offer)` explicitly retains one identity/request before network;
  `begin`, `claim` and `cancel` exchange that exact original. Pending, admitting,
  timeout and generic failure preserve it. Only an exact typed terminal result
  permits a fresh session, preserving the same usable identity and immutable pin.
- `open(offer)` reopens actual wrappers and re-verifies approval and self admission.
  Login, a ready receipt and possession proofs alone never start key reception.
- A session exposes verified ledger reads/refresh, finite key rounds, status,
  document protection, ordinary ledger commands and explicit resume/ACK,
  rotation and closed product RPC preparation/response verification. Commands do
  not silently reconcile a different intent or re-sign an unknown submission.
- `close()` fences admission, interrupts/joins operations, then releases key,
  credential and database owners. Close/logout/cache cleanup never delete identity.
  The composition creates no timer, document Repo or ordinary transport.

## Approval, replacement and failures

Snapshot approval uses the independently transferred endorser and the fixed core
verifier. Full history replays every signature from the independently pinned
genesis. Both must admit the exact personal signing/encryption keys and member.
The protected credential packet also authenticates immutable offer pins. Raw
approval pages and their checksums remain evidence to replay, never authority.

`personalLedgerControl({ approval })` composes a persistent `LedgerFeed` over
injected `LedgerFeedStore`, `LedgerPinStore`, `SubmissionJournal`, `LedgerLog`,
`LedgerFeedSource` and `WorkspaceScope`. Keep the feed/pins in a stable database;
use a separate submission slot per incarnation. Refresh is bounded and verifies
every suffix before persisting its position. No corrupt row is reset or rebased.

Explicit `prepare(offer, true)` prepares a wrapped replacement candidate while the
old pointer remains current. A second unresolved candidate is refused. Replacement
opening requires new full-history desktop approval and successful pin/origin
qualification, then actual `drainOld` and the approved atomic retired archive/current
switch. The host retains the first snapshot origin in the new approval original.
On cold reopen its historical manager/signature/state are requalified from the
new signed full history; a cached old label or lost KEK cannot confer trust.
Missing or indeterminate originals require fresh approval, never KEK recreation.

Key acquisition is lazy and independent of ledger ownership. Temporary key/repair
failures remain retryable without sealing the ledger. Status and document sends
may select a valid admitted retained epoch when the current key is missing;
rotation advice does not block permitted sends. Revocation, a changed local
incarnation, rollback or wrong scope still blocks key/RPC/content operations.
Core retains and verifies receive/report/distribution originals; the shared finite
maintenance owner acknowledges only observed terminal results, including a
successful sibling when another phase failed. There is no plaintext fallback.

## Verification and limits

`pnpm --filter @lody/e2ee-client test` runs fixed proof/credential-boundary tests.
`test:browser` uses actual Chromium/WebKit crypto, Web Locks and IndexedDB, including
process reopen, interrupted installation readback, unknown relay results, close,
atomic replacement, retained-epoch sending, revocation and transactional failures.
The portable bundle targets Safari 16.4 with no Node dependency; this does not
establish iOS 16.4 device, native plugin, hardware or power-loss acceptance.
IndexedDB `strict` is a durability hint. Web trusts the code served to the page
with private-key use, as the [approved custody Spec](../../specs/e2ee/client-custody.md)
requires. This package does not enable a product runtime; application bridging is
separate. [Ownership rationale](../../.agents/notes/implemented/architecture/2026-10-16-e2ee-core-service-architecture.md#personal-device-product-composition).
