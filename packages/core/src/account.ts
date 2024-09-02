import { signal } from '@preact/signals-core';
import type { PublicKey } from './crypto/pubkey';
import type { Tx } from './tx.js';
import type { Loading, NetworkConfig, Signer } from './types';

export interface AccountData {
  network: NetworkConfig;
  address: string;
  /** The account index within the wallet's local state, as used in the private key derivation algorithm. */
  accountIndex: number;
  accountNumber: bigint | undefined;
  publicKey: PublicKey;
  sequence: bigint;
}

/** A Bound Account which can be used to sign & broadcast messages. Should not be used in the UI
 * as it is not reactive and does not update when the user changes their selected keyring in their
 * wallet.
 */
export abstract class Account {
  constructor(public readonly signer: Signer) {}

  /** Signal storing this account's data. Although you practically can, you shouldn't manipulate
   * this data directly. Instead, use the `bind` method to update the account data.
   */
  signal = signal<Loading<AccountData>>({ loading: true });

  async bind(network: NetworkConfig, accountIndex?: number) {
    accountIndex ??= this.accountIndex ?? 0;
    await this.onNetworkChange(network, accountIndex);
  }

  /** Sign & pass back the given transaction. */
  abstract sign(tx: Tx): Promise<Tx>;

  /** The actual meat of the implementation. This should A) cache address & public key, and B)
   * retrieve the account's sequence number from the blockchain as well as monitor for new txs
   * made from this account to keep it in sync.
   */
  protected abstract onNetworkChange(network: NetworkConfig, accountIndex: number): Promise<void>;

  get network() { return this.signal.value.network }
  get address() { return this.signal.value.address }
  /** The account index within the wallet's local state, as used in the private key derivation algorithm. */
  get accountIndex() { return this.signal.value.accountIndex }
  /** The account number as registered on the chain. May be undefined if the account has never been seen on-chain, i.e. has never received funds. */
  get accountNumber() { return this.signal.value.accountNumber }
  get publicKey() { return this.signal.value.publicKey }
  get sequence() { return this.signal.value.sequence }
}
