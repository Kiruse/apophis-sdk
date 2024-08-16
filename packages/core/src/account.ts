import { signal } from '@preact/signals-core';
import type { Loading, NetworkConfig } from './types';
import Tx from './tx';

export interface AccountData {
  network: NetworkConfig;
  address: string;
  /** The account index within the wallet's local state, as used in the private key derivation algorithm. */
  accountIndex: number;
  publicKey: Uint8Array;
  sequence: bigint;
}

/** A Bound Account which can be used to sign & broadcast messages. Should not be used in the UI
 * as it is not reactive and does not update when the user changes their selected keyring in their
 * wallet.
 */
export abstract class Account<TX> {
  /** Signal storing this account's data. Although you practically can, you shouldn't manipulate
   * this data directly. Instead, use the `bind` method to update the account data.
   */
  signal = signal<Loading<AccountData>>({ loading: true });

  async bind(network: NetworkConfig, accountIndex?: number) {
    accountIndex ??= this.accountIndex ?? 0;
    await this.onNetworkChange(network, accountIndex);
  }

  /** Sign & pass back the given transaction. */
  abstract sign(tx: TX): Promise<TX>;

  /** The actual meat of the implementation. This should A) cache address & public key, and B)
   * retrieve the account's sequence number from the blockchain as well as monitor for new txs
   * made from this account to keep it in sync.
   */
  protected abstract onNetworkChange(network: NetworkConfig, accountNumber: number): Promise<void>;

  get network() { return this.signal.value.network }
  get address() { return this.signal.value.address }
  /** The account index within the wallet's local state, as used in the private key derivation algorithm. */
  get accountIndex() { return this.signal.value.accountIndex }
  get publicKey() { return this.signal.value.publicKey }
  get sequence() { return this.signal.value.sequence }
}
