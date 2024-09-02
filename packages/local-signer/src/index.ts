import { signers } from '@apophis-sdk/core';
import { LocalSigner } from './signer';
export * from './account';
export { LocalSigner };

signers.push(LocalSigner);
