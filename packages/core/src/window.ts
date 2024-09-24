import { signers } from './constants';
import type { Signer } from './signer';

export interface CosmosWindow {
  signers: Signer[];
}

declare global {
  interface Window {
    cosmos: CosmosWindow;
  }
}

if (typeof window !== undefined) {
  window.cosmos = {
    signers,
  };
}
