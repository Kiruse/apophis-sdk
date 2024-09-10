import { signers } from '@apophis-sdk/core';
import { KeplrDirect } from './signer.js';

export const Keplr = {
  Direct: KeplrDirect,
} as const;

export default Keplr;
export { KeplrDirect };

signers.push(Keplr.Direct);
