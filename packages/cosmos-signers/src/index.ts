import { Signer } from '@apophis-sdk/core';
import { Keplr, Leap } from '@apophis-sdk/keplr-signer';
import { WalletConnectCosmosSigner } from '@apophis-sdk/walletconnect-signer';
import { GalaxyStation } from './galaxystation.js';

export * from '@apophis-sdk/keplr-signer';
export * from '@apophis-sdk/walletconnect-signer';
export * from './galaxystation.js';

export function registerCosmosSigners(walletConnectProjectId?: string) {
  Signer.register(Keplr);
  Signer.register(Leap);
  Signer.register(GalaxyStation);
  if (walletConnectProjectId) {
    Signer.register(new WalletConnectCosmosSigner({ projectId: walletConnectProjectId }));
  }
}
