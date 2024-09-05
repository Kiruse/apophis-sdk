import type { Signer } from './types';

/** Symbol used to mark the `typeUrl` property of `Any` types. This symbol helps distinguish types that can be converted to `Any` from an `Any` type itself. */
export const AnyTypeUrlSymbol = Symbol('Any.TypeUrl');

/** Array of registered signers. Can be used to iterate over the various imported integrations to check for availability. */
export const signers: Signer[] = [];

export const config = {
  /** Multiplier for the gas fee estimate to avoid under-estimation. Should generally be held low
   * to avoid overspending as, unlike Ethereum chains, Cosmos chains do not refund unused gas.
   */
  gasFactor: 1.2,
};
