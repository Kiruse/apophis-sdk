import { Signer } from '@apophis-sdk/core';
import { KeplrSigner, LeapSigner } from '@apophis-sdk/keplr-signer';
import { WalletConnectCosmosSigner } from '@apophis-sdk/walletconnect-signer';

export * from '@apophis-sdk/keplr-signer';
export * from '@apophis-sdk/walletconnect-signer';

export function registerCosmosSigners(walletConnectProjectId: string | undefined) {
  Signer.register(new KeplrSigner());
  Signer.register(new LeapSigner());
  if (walletConnectProjectId) {
    // Signer.register(new WalletConnectCosmosSigner({ projectId: walletConnectProjectId }));
  }
}
