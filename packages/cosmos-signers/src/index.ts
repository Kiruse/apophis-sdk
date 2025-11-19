import { Signer } from '@apophis-sdk/core';
import { Keplr, Leap } from '@apophis-sdk/keplr-signer';
import { WalletConnectCosmosSigner } from '@apophis-sdk/walletconnect-signer';

export * from '@apophis-sdk/keplr-signer';
export * from '@apophis-sdk/walletconnect-signer';

export function registerCosmosSigners(walletConnectProjectId?: string) {
  Signer.register(Keplr);
  Signer.register(Leap);
  if (walletConnectProjectId) {
    Signer.register(new WalletConnectCosmosSigner({ projectId: walletConnectProjectId }));
  }
}
