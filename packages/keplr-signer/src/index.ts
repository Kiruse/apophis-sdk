import { signers } from '@crypto-me/core';
import { KeplrDirect } from './signer.direct';
// import { KeplrAmino } from './signer.amino';

const Keplr = {
  Direct: KeplrDirect,
  // Amino: KeplrAmino,
} as const;

export default Keplr;
export { KeplrDirect };

signers.push(Keplr.Direct);
// signers.push(Keplr.Amino);
