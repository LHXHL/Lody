# Personal-device client host

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

Read the [custody Spec](../../specs/e2ee/client-custody.md), [core rules](../e2ee-core/AGENTS.md)
and [platform rules](../platform/AGENTS.md) before changing these boundaries.

- This package composes the existing core, portable curve capabilities and injected
  storage/custody/remote ports. It imports no Node, Electron, filesystem or SQLite API.
  Keep desktop adapters as consumers of shared logic, rather than copying a second service tree.
- Capture account/workspace/pinned genesis and the exact local incarnation before
  any work. An offer arrives independently; a relay cannot choose its pins. Login,
  custody readiness and receipts never authorize admission or key reception.
- Retain first request, approval and claim originals before network; reverify keys,
  credentials and approval on reopen. Never re-sign or switch a session on unknown
  results. Only independently verified current ledger admission permits receiving keys.
- Keep genuine ledger reads usable under independent key/repair failures. Missing
  current epoch alone does not refuse an admitted retained key. Rotation advice
  never blocks otherwise permitted sends, and malformed remote input never retires
  a healthy local store. No plaintext, fresh namespace or memory-only fallback.
- Enter custody writer ownership before allocating identity and through actual
  native settlement, then release before network. Only the same fiber may reenter.
  Close fences new work, aborts network waiters and drains actual borrowed crypto;
  late completion cannot revive closed or replaced owners. Acquire returned
  secret buffers together with wipe registration through acquireRelease or
  acquireUseRelease; native settlement alone does not establish cleanup ownership.
- Replacement verifies new desktop approval, drains the old incarnation and uses
  the approved atomic archive/current switch. Preserve old pins, wrappers and
  journals. Logout, close and ordinary cache cleanup never delete identity.
- RPC exposes the existing closed product methods and exact original retries,
  never private keys, credentials or generic signing to product callers. Real
  injected implementations are required; no empty handler substitutes for support.
