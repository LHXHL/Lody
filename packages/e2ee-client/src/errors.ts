import { Data } from 'effect';
/** Scoped personal-client failure. The opaque cause is for trusted local diagnostics only; product surfaces use code. */
export class PersonalHostError extends Data.TaggedError('PersonalHostError')<{
  readonly code:
    | 'closed'
    | 'invalid-input'
    | 'scope-mismatch'
    | 'conflict'
    | 'approval-required'
    | 'identity-lost'
    | 'corrupt'
    | 'protection-unavailable'
    | 'keys-unavailable'
    | 'revoked'
    | 'unsupported'
    | 'storage'
    | 'network'
    | 'restart-required';
  readonly cause?: unknown;
}> {}
export const fail = (code: PersonalHostError['code'], cause?: unknown) =>
  new PersonalHostError({ code, ...(cause === undefined ? {} : { cause }) });
