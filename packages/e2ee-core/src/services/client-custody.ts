import { Context, type Effect, Schema } from 'effect';
import type { GenesisHash, SigningPublicKey } from '../internal/foundation/bytes';
import type { LocalStoreError } from './errors';

/** Routing slot known before reading an installation; genesis is independently pinned, not a server label. */
export interface ClientCustodyScope {
  readonly accountId: string;
  readonly workspaceId: string;
  readonly genesis: GenesisHash;
}

/**
 * One personal-device installation. Capture and validate this entire binding
 * when acquiring either port, never from a ciphertext or a server hint. Account
 * and workspace identifiers are routing scope, not authority; genesis is pinned
 * independently and device is the expected signing identity. installationId is
 * lowercase hex of 32 secure random bytes retained before creating protection, never a PID,
 * timestamp or substitute for desktop approval.
 */
export interface ClientCustodyBinding extends ClientCustodyScope {
  readonly device: SigningPublicKey;
  readonly installationId: string;
}

/** Closed local-wrapping purposes; installed and unpublished keys remain distinct capabilities. */
export type ClientKeyPurpose =
  | 'signing-private-key'
  | 'encryption-private-key'
  | 'device-credential'
  | 'installed-epoch-key'
  | 'rotation-candidate';

/** Protection availability only; even available grants no ledger or runtime authority. */
export type ClientCustodyStatus =
  | 'missing'
  | 'locked'
  | 'available'
  | 'unavailable'
  | 'indeterminate';

/**
 * Content-free failure. locked waits for platform unlock; unavailable refuses
 * protected opening. identity-lost, corrupt and indeterminate preserve originals
 * and require desktop reapproval unless the exact interrupted install can be
 * reconciled. conflict never displaces a competing writer. No error authorizes
 * a new identity, file/plaintext fallback or deletion.
 */
export class ClientCustodyError extends Schema.TaggedError<ClientCustodyError>()(
  'ClientCustodyError',
  {
    reason: Schema.Literals([
      'locked',
      'unavailable',
      'identity-lost',
      'corrupt',
      'indeterminate',
      'conflict',
      'closed',
    ]),
  }
) {}

/**
 * Narrow trusted-platform boundary, captured for one complete binding. Web uses
 * a persisted non-extractable AES-GCM KEK; mobile uses device-bound native
 * protection. It never exports the KEK, signs, verifies, accesses arbitrary
 * files, or decides approval. wrap/unwrap authenticate version, complete binding
 * and purpose using the client custody Spec's local wrapping v1 encoding;
 * blobs own their bytes. No transaction spans crypto/native work.
 *
 * The acquiring Scope owns admission and native settlement: reject new work on
 * close, join actual operations before wiping borrowed input or releasing the
 * writer, and retain uncertain installation outcomes for reconciliation. A
 * cancelled waiter or elapsed deadline never proves native termination.
 */
export class ClientKeyCustody extends Context.Service<
  ClientKeyCustody,
  {
    /** Exact captured scope, including the retained installation incarnation. */
    readonly binding: ClientCustodyBinding;
    /** Observe without creating or replacing any key; missing is never permission to initialize. */
    status(): Effect.Effect<ClientCustodyStatus, ClientCustodyError>;
    /**
     * Explicit first installation only, after durable preparation and desktop
     * pairing consent. Persist/read back the KEK; identical retry reconciles the
     * same installation, never regenerates a missing retained KEK or replaces
     * residual or uncertain state.
     */
    create(): Effect.Effect<void, ClientCustodyError>;
    /** Secure nonce unique under this KEK across writers/recovery; borrow input until settlement and return owned ciphertext. */
    wrap(
      purpose: ClientKeyPurpose,
      body: Uint8Array
    ): Effect.Effect<Uint8Array, ClientCustodyError>;
    /** Exact authenticated body or failure; caller owns and wipes the returned plaintext after use. */
    unwrap(
      purpose: ClientKeyPurpose,
      blob: Uint8Array
    ): Effect.Effect<Uint8Array, ClientCustodyError>;
    /**
     * Explicit scoped hard reset or authenticated terminal removal only, after
     * users drain; never close/logout/cache cleanup. Compare the retained
     * incarnation before deletion, spare replacements and other bindings, and
     * retain an unknown outcome for readback. The host owns authorization.
     */
    delete(): Effect.Effect<void, ClientCustodyError>;
  }
>()('@lody/e2ee-core/ClientKeyCustody') {}

/** A local authenticated wrapper, never unprotected key material or a wire-format envelope. */
export interface ClientWrappedKey {
  readonly purpose: Exclude<ClientKeyPurpose, 'installed-epoch-key' | 'rotation-candidate'>;
  readonly blob: Uint8Array;
}

/**
 * Recoverable local installation receipt, not approval evidence. prepared is
 * saved before KEK creation; protected retains the first complete wrappers;
 * ready follows readback, actual unwrap and key-pair verification. retired stops
 * reopening that incarnation. Missing/unknown halves never imply fresh install.
 */
export interface ClientInstallation {
  readonly binding: ClientCustodyBinding;
  readonly revision: number;
  readonly phase: 'prepared' | 'protected' | 'ready' | 'retired';
  readonly wrapped: readonly ClientWrappedKey[];
}

/**
 * Installation-only atomic storage; ledger pins and submission/key journals
 * keep their existing ports. Capture one routing scope, including on an empty store.
 * The slot is keyed by account/workspace/genesis, not installationId or device:
 * another retained incarnation conflicts rather than manufacturing absence.
 * Returned bytes are owned copies and untrusted until authenticated. Quota or
 * abort leaves originals intact; commit-with-lost-response is reconciled by read.
 * Stores never interpret a receipt as authority or persist unwrapped secrets.
 */
export class ClientInstallationStore extends Context.Service<
  ClientInstallationStore,
  {
    /** Routing scope for reopen before the retained device/incarnation is known. */
    readonly scope: ClientCustodyScope;
    /** Read the retained original without generating, repairing or deleting anything. */
    read(): Effect.Effect<ClientInstallation | null, LocalStoreError>;
    /**
     * null requires absence and next.revision=0; otherwise require the exact
     * current revision and next.revision=expected+1. Validate binding, phase and
     * immutable original wrappers; write and read back in one short transaction.
     * The first row selects device/installationId once; later rows must match.
     * prepared starts empty and gains exactly one original for each identity
     * purpose on transition to protected. protected advances to ready; any
     * live phase may retire without replacing wrappers. Never clear a retired row
     * to manufacture absence. No crypto/network await inside the transaction.
     */
    compareAndSet(
      expected: number | null,
      next: ClientInstallation
    ): Effect.Effect<void, LocalStoreError>;
  }
>()('@lody/e2ee-core/ClientInstallationStore') {}
