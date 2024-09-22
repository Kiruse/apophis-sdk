import { connections, Cosmos, signals, SignData, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Tx } from '@apophis-sdk/core/tx.js';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { signal } from '@preact/signals-core';
import { SignClient } from '@walletconnect/sign-client';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { type WalletConnectSignerConfig } from './config';
import LOGO_DATA_URL from './logo';
import { promptURI } from './prompt';

export class WalletConnectSigner implements Signer {
  #client: ReturnType<typeof SignClient.init>; // which is a Promise<SignClient> but they did the typing weird
  readonly type = 'walletconnect';
  readonly displayName = 'WalletConnect';
  readonly logoURL = LOGO_DATA_URL;
  readonly available = signal(true);
  readonly signData = signal<SignData | undefined>();

  constructor(public readonly config: WalletConnectSignerConfig) {
    this.#client = SignClient.init({
      projectId: config.projectId,
      metadata: config.metadata,
    });
  }

  probe() {
    // WalletConnect cannot deterministically tell if the user has any other remote wallets, so it's
    // always available.
    return Promise.resolve(true);
  }

  async connect(networks: NetworkConfig[]) {
    const client = await this.#client;
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        cosmos: {
          methods: ['cosmos_getAccounts', 'cosmos_signDirect', 'cosmos_signAmino'],
          events: [],
          chains: networks.map((network) => 'cosmos:' + network.chainId),
        },
      },
    });

    if (!uri) throw new Error('No WalletConnect URI');
    console.log(uri);
    await promptURI(uri, this.config);

    return approval()
      .then(session => {
        console.log(session);
      });
  }

  sign(network: NetworkConfig, tx: Tx): Promise<Tx> {
    throw new Error('Method not implemented.');
  }

  broadcast(tx: Tx): Promise<string> {
    throw new Error('Method not implemented.');
  }

  addresses(networks?: NetworkConfig[]): string[] {
    throw new Error('Method not implemented.');
  }

  address(network: NetworkConfig): string {
    throw new Error('Method not implemented.');
  }

  getSignData(network: NetworkConfig): SignData {
    throw new Error('Method not implemented.');
  }
}
