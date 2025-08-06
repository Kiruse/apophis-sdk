import { KeplrSigner } from './base.js';
import LOGO_DATA_URL from './logos/leap.js';

// leap's types library is broken & I cba to monkeypatch it
declare global {
  interface Window {
    leap?: any;
  }
}

export class LeapSigner extends KeplrSigner {
  override get type() { return 'Leap' }
  override get displayName() { return 'Leap' }
  override get logoURL() { return LOGO_DATA_URL }

  constructor() {
    super();
  }

  override keplrProbe() {
    return !!window.leap;
  }

  override probe(): Promise<boolean> {
    return Promise.resolve(this.available.value = !!window.leap);
  }

  /** Get the Leap instance. Primarily used internally. Unfortunately, the typing is broken. */
  override get backend() {
    return window.leap;
  }
}

export const Leap = new LeapSigner();

// Update all signers when the keystore changes
if (typeof window !== 'undefined') {
  window.addEventListener('leap_keystorechange', KeplrSigner.resetAll);
}
