import type { Signer } from './signer';
import type { ApophisConfig } from './types';

/** Symbol used to mark the `typeUrl` property of `Any` types. This symbol helps distinguish types that can be converted to `Any` from an `Any` type itself. */
export const AnyTypeUrlSymbol = '@@typeUrl@@';

/** Array of registered signers. Can be used to iterate over the various imported integrations to check for availability. */
export const signers: Signer[] = [];

/** Global configuration object providing fallback values for when local configuration does not specify it. */
export const config: ApophisConfig = {
  gasFactor: 1.2,
};
