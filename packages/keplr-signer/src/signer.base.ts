import { type Account, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { toHex } from '@apophis-sdk/core/utils.js';
import { BroadcastMode, type Window as KeplrWindow } from '@keplr-wallet/types';
import { signal } from '@preact/signals-core';
import LOGO_DATA_URL from './logo';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

export abstract class KeplrSignerBase implements Signer {
  #available = signal(!!window.keplr);

  abstract get type(): string;
  get displayName() { return 'Keplr' }
  get logoURL() { return LOGO_DATA_URL }

  probe(): Promise<boolean> {
    return Promise.resolve(this.#available.value = !!window.keplr);
  }

  async connect(networks: NetworkConfig[]) {
    if (!window.keplr) throw new Error('Keplr not available');
    await window.keplr.enable(networks.map((network) => network.chainId));
  }

  abstract account(): Account;

  async broadcast(tx: Tx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    try {
      const hashbytes = await window.keplr!.sendTx(network.chainId, tx.bytes(), BroadcastMode.Async);
      const hash = toHex(hashbytes);
      tx.confirm(hash);
      return hash;
    } catch (error: any) {
      tx.reject(tx.hash!, error);
      throw error;
    }
  }

  countAccounts(network: NetworkConfig): Promise<number> {
    if (!window.keplr) throw new Error('Keplr not available');
    const signer = window.keplr.getOfflineSigner(network.chainId);
    return signer.getAccounts().then((accounts) => accounts.length);
  }

  get available() { return this.#available }
}
