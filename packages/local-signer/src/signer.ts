import { signal } from '@preact/signals-core';
import { Account, Cosmos, getRest, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { LocalAccount } from './account';
import { BroadcastMode } from '@apophis-sdk/core/types.sdk.js';

export const LocalSigner = new class implements Signer {
  readonly type = 'local';
  readonly available = signal(false);
  readonly displayName = 'Local';
  readonly logoURL = undefined;

  probe(): Promise<boolean> {
    return Promise.resolve(true);
  }

  connect(networks: NetworkConfig[]): Promise<void> {
    // noop
    return Promise.resolve();
  }

  account(): Account {
    return new LocalAccount(this);
  }

  async broadcast(tx: Tx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    const url = getRest(network);
    if (!url) throw new Error('No REST endpoint available');

    const { tx_response: response } = await Cosmos.rest(network).cosmos.tx.v1beta1.txs('POST', { mode: BroadcastMode.BROADCAST_MODE_SYNC, tx_bytes: tx.bytes() });
    if (response.code) {
      tx.reject(response.txhash, response.raw_log);
    } else {
      tx.confirm(response.txhash);
    }
    return response.txhash;
  }

  countAccounts(network: NetworkConfig): Promise<number> {
    return Promise.resolve(1);
  }
}
