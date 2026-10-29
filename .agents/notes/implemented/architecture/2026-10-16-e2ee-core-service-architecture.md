# E2EE core as ports, workflows and adapters

Status: implemented
Translation: current
PR: [Browser ledger/original stores #2053](https://github.com/LodyAI/Lody/pull/2053)

[中文](2026-10-16-e2ee-core-service-architecture.zh.md)

## Abstract

`@lody/e2ee-core` exposed about twenty factory functions that each opened their
own SQLite files, took raw callbacks for remote systems and kept a private
rollback pin. That made the library hard to reuse outside Lody, hard to read,
and impossible to run against another backend or store. The core is now split
into ports (Effect services the application provides), workflows (services the
library implements as Layers on those ports only) and adapters, behind role-based
entries plus an unstable `./internal`. Node SQLite, browser ledger/original
IndexedDB, JS curves and Loro Streams adapters implement separate capabilities;
storage never grants authority. Protocol bytes and workflow guarantees stay with
the existing core. Persistent browser key protection and product composition remain
separate from these storage and crypto adapters.

## Problem

- Each workflow factory (`makeSqliteEpochReceiver`, `makeSqliteKeyDistribution`,
  `makeSqliteEpochRotation`, …) took paths, modes, protectors and remote
  callbacks, opened its own stores and nested other factories. Composition was
  implicit and duplicated; a different backend or store meant forking code.
- Every store embedded its own ledger pin, so rollback protection was copied
  into seven places with slightly different error mapping.
- Twenty-five package subpaths mixed pure protocol, host-only workflows,
  adapters and test helpers; the README described an earlier extraction.
- Error channels were often `unknown`; most functions were `Effect.gen`
  wrappers.

## Decision

1. **Ports** (`./services`): backend (`LedgerLog`, `LedgerFeedSource`,
   `KeyMailbox`, `EpochStagingStore`), platform (`DeviceIdentity`,
   `KeyProtector`, `CandidateProtector`), application (`WorkspaceScope`,
   `LedgerViewSource`, `EpochPublicationSource`) and local storage (one port
   per journal or store). Ports carry typed errors (`BackendError`,
   `LocalStoreError`, …) and JSDoc contracts.
2. **Workflows** (`.`): `VerifiedLedger`, `LedgerFeed`, `LedgerSubmission`,
   `InstalledEpochKeys`, `InstalledEpochHistory`, `KeyReceiver`, `KeyRepair`,
   `KeyDistributor`, `EpochPublisher`, each a `Context.Service` with a `layer`
   that depends only on ports and protocol code. `E2eeWorkflows` composes them.
3. **One rollback guard.** `VerifiedLedger` with a single `LedgerPinStore`
   replaces the per-store pins. Pin-fault coverage moved to one owning suite.
4. **Adapters** implement ports behind separate entries. Store mutations verify
   their own write and captured binding inside the same transaction, so an ignored
   or mismatched write aborts. SQLite remains the reference for all local ports;
   IndexedDB supplies only ledger/pin/submission and pairing originals.
5. **Backend contract** (`./host`): staging DTOs as Effect Schemas, request
   signing bytes and stage-request checks, plus the mailbox rule functions.
   Platform-neutral; `@lody/cloud-api` re-exports the staging contract instead
   of defining it.
6. **Effect practice.** Public methods are `Effect.fn` spans; helpers are
   `Effect.fnUntraced`; functions that only wrapped `Effect.gen` became
   `Effect.fnUntraced`; workflows declare complete failure unions.

## Discoveries and choices

- **Close semantics are per workflow.** Making every workflow wait for
  in-flight calls on Scope close deadlocked existing tests: receive, repair and
  distribution intentionally let in-flight remote work fail at the next guard
  instead of being awaited. Only owners of native protection (installed keys,
  history, publisher) wait. Both behaviors are explicit (`makeAdmissionGate`,
  `makeCloseGuard`).
- **Capture at construction.** The old factories bound borrowed callbacks at
  initialization; a test mutates them afterwards. Workflows now capture ports
  with `own()` so a later mutation cannot swap a capability.
- **Candidate protection stays separate.** The reviewed decision that an
  unpublished rotation key uses a distinct protector from installed keys is
  kept as a separate `CandidateProtector` port, rather than reusing
  `KeyProtector`.
- **Public contract completion.** The documentation check now traverses namespace
  exports and resolved service members, including inherited contracts. The old
  check missed `Bytes` exports and service methods with no JSDoc. A compiler-backed
  fixture checks both rejection and acceptance; documentation quality still needs
  human review. Public ledger/key workflow queries and acknowledgements now have
  named spans too, without adding argument attributes or installing telemetry.
  `LedgerViewSourceError` replaces the view port's `unknown` error channel;
  expected source failures keep the cause and leave the rollback pin unchanged.
  This changes the adapter's compile-time contract, not ledger or wire behavior.
  Submission acknowledgement still copies its argument at invocation, before
  the lazy traced body runs; the real-journal test mutates the caller's argument
  before execution to preserve that ownership guarantee.
- **Delivery refusals propagate.** Only an `unavailable` mailbox leaves a
  delivery `Pending`; a refusal (unauthorized, conflict) fails, matching the old
  distinction between transport loss and host rejection.
- **Unified feed store.** Full-history and snapshot feeds share one
  `LedgerFeedStore` (origin plus suffix records); verification lives in
  `LedgerFeed`. File formats of all stores were re-versioned, since nothing is
  deployed.
- **Alternatives considered.** Keeping the factories and documenting them was
  rejected: it would not make backends or storage replaceable. One entry per
  module was rejected: it hides who each export is for.

## Workspace and recovery (stack layer 3)

- The `E2eeWorkspace` facade no longer receives prebuilt factory objects. A
  `WorkspacePlatform` returns a Layer of ports, and the facade builds
  `E2eeWorkflows` plus `WorkspaceControl` in the workspace Scope. The handle's
  methods are unchanged, so platforms change only how they supply resources.
- `LedgerSync` (application port) replaces the old ledger client plus
  checkpoint callback. The workspace derives `LedgerViewSource` from
  `LedgerSync.refresh`, preserving the old behavior that every workflow read
  refreshes the feed.
- Recovery vault storage is two ports (`RecoveryVaultStore`,
  `RecoveryVaultLocalStore`) with a `RecoveryVaults` workflow. The vault wire
  DTOs move to `./host` as Schemas, and `@lody/cloud-api` re-exports them, as
  with staging.
- Workspace errors use `Schema.TaggedError` with `reason`, like other public
  errors.

## The Lab on the services (stack layer 5)

- The Lab's `WorkspacePlatform` supplies ports like an external integrator.
  Its ledger actor exposes `LedgerSync`, `SubmissionJournal` and `LedgerLog`;
  its HTTP mailbox and staging clients become `KeyMailbox` and
  `EpochStagingStore`. The ledger pin and candidate files are per actor,
  because several actors share one directory, and a shared pin would couple
  their rollback knowledge.
- Single-component fault harnesses use `./internal` testing helpers. These
  open one workflow (receiver, distributor, publisher…) from the real Layers
  with per-store options; there is no second implementation.
- Platform callbacks `documentState` and `recoveryConfiguration` receive the
  workspace's built services, since a platform may need workflows (key reads,
  delivery) while assembling native state or recovery inputs.
- The Lab projects service errors by `reason` and protocol errors by `code`;
  the staging adapter keeps a backend refusal's reason.

## Browser storage boundary

A per-device database was rejected: replacing a lost identity would also lose its
workspace rollback knowledge and unresolved originals. The IndexedDB adapter keeps
one stable account/workspace/genesis database. Pairing rows add the local device,
installation, session and purpose; replacement retains old exchanges. Its pin
revision token is a local CAS precondition, never an authority or mode cache.

The adapter uses native short callback transactions rather than awaiting crypto
or network inside IDB. Strict durability is a browser hint; `complete`, after
readback and binding checks, is the observable success boundary. Closing fences
new work and drains actual transaction promises; unknown results reconcile from
retained first bytes. No fallback database or implicit reset restores availability.
The host must independently requalify retained ledger state and verify approval,
protect secret pairing material before storage, and handle loss of persistent
protection under the [custody contract](../../../../specs/e2ee/client-custody.md).
Receive/epoch/mailbox/outbox/repair/snapshot journals remain a separate capability.

## Verification

`packages/e2ee-core/test/composition.test.ts` uses real workflow Layers and crypto
for device key delivery. `packages/e2ee-core/test/public-docs.test.ts` checks JSDoc
and entry surfaces. `packages/e2ee-core/test/indexeddb.browser.test.ts` uses real
Chromium/WebKit persistent profiles, process reopen, competing tabs, native abort/
quota/mismatched-write faults and close. It pins exact original retention, atomic
record/cursor rollback and qualified retained-state reopen. These synthetic
browser-engine checks do not establish minimum-OS, real-device or production
acceptance. The package remains private at `0.0.0`; reusable boundaries do not
publish a standalone SDK or enable a product host.
