import { signers } from './constants';
import { Signer } from './types';

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
