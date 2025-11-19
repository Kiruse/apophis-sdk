import { KeplrSigner } from '@apophis-sdk/keplr-signer';
import GALAXYSTATION_LOGO_DATAURL from './logos/galaxystation.js';

declare global {
  interface Window {
    galaxyStation?: {
      keplr: typeof window.keplr;
    }
  }
}

export class GalaxyStationSigner extends KeplrSigner {
  get type() { return 'GalaxyStation' }
  get displayName() { return 'Galaxy Station' }
  get logoURL() { return GALAXYSTATION_LOGO_DATAURL }
  get canAutoReconnect() { return true }

  constructor() {
    super();
  }

  override keplrProbe(): boolean {
    return typeof window !== 'undefined' && !!window.galaxyStation;
  }

  override get backend(): any {
    return window.galaxyStation!.keplr;
  }
}

export const GalaxyStation = new GalaxyStationSigner();

// Update all signers when the keystore changes
if (typeof window !== 'undefined') {
  window.addEventListener('galaxyStation_keystorechange', KeplrSigner.resetAll);
}
