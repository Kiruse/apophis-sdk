import type { ApophisConfig, Signer } from './types';

/** Symbol used to mark the `typeUrl` property of `Any` types. This symbol helps distinguish types that can be converted to `Any` from an `Any` type itself. */
export const AnyTypeUrlSymbol = Symbol('Any.TypeUrl');

/** Array of registered signers. Can be used to iterate over the various imported integrations to check for availability. */
export const signers: Signer[] = [];

export const config: ApophisConfig = {
  gasFactor: 1.2,
};
