import { Signal } from '@preact/signals-core';
import type { Account } from './account.js';
import type { NetworkConfig } from './networks.js';
import type { Tx } from './tx.js';

export { NetworkConfig };

/** Signers provide write access to on-chain data. They do not provide read access. They allow
 * passing messages to the user for signing, and then broadcasting these signed messages to the
 * blockchain network.
 *
 * The general flow is:
 *
 * 1. Acquire a signer from the user in the frontend. The signer should be stored in the `signer` signal.
 * 2. Acquire & bind an account. The account should be stored in the `account` signal.
 * 3. Create a transaction, e.g. with `Cosmos.tx()`.
 * 4. Sign the transaction with the account's `sign` method.
 * 5. Broadcast the transaction with the signer's `broadcast` method.
 */
export interface Signer {
  /** Unique type identifier of this signer to help distinguish which you're using. Or at least it should be unique. */
  get type(): string;
  /** The name of the wallet to show as tooltip or when no logo is available. */
  get displayName(): string;
  /** The URL of the wallet logo. Will be shown in an <img> HTML tag. If omitted, the frontend integration should fall back to `displayName`. */
  get logoURL(): string | URL | undefined;

  /** Check whether this signer is available. */
  probe(): Promise<boolean>;

  /** Connect the signer for the given networks. */
  connect(networks: NetworkConfig[]): Promise<void>;

  /** Retrieve an abstract, unbound account associated with this signer. It must next be bound to
   * a network & account number using its `bind` method.
   */
  account(): Account;

  /** Broadcast a signed transaction. Returns the tx hash if successful. */
  broadcast(tx: Tx): Promise<string>;

  /** Count how many accounts this signer tracks. Not every signer may actually track this value and may thus throw. */
  countAccounts(network: NetworkConfig): Promise<number>;

  /** Get a signal representing whether this Signer is available. This signal should be updated during a call to `.probe()`. */
  get available(): Signal<boolean>;
}

export type Loading<T> = ({ loading: true } & Partial<T>) | ({ loading: false } & T);
