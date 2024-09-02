import { Decimal } from '@kiruse/decimal';
import { Signal } from '@preact/signals-core';
import type { Account } from './account.js';
import type { Tx } from './tx.js';

export interface NetworkConfig {
  chainId: string;
  prettyName: string;
  /** The unique registry name. */
  name: string;
  /** An optional prefix that should be ignored when shortening addresses in the UI. */
  addressPrefix?: string;
  /** Optional slip44 coin type for HD wallets. This is only relevant for local signers, not for
   * third party signers like Metamask or Keplr. Local signers are typically used on backends or in
   * tools, but not in the frontend.
   *
   * **Note:** Often, we have heuristics to choose a good default. For example, most Cosmos chains
   * use 118. Some chains like Terra use 330. You may find the coin type in the official
   * [SLIP44 Registry](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) or in the
   * [Cosmos Chain Registry](https://github.com/cosmos/chain-registry).
   * However, the exact coin type only matters when attempting to load the same mnemonic into a
   * different wallet. Thus, when used for local tooling, as long as you're consistent about the
   * coin type, it doesn't actually matter which value you use.
   */
  slip44?: number;
  /** The available fee denominations. */
  feeDenoms: string[];
  /** The default gas price. */
  gasPrice: Decimal | number;
}

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
