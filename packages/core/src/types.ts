import { Signal } from '@preact/signals-core';
import type { NetworkConfig } from './networks.js';
import type { Tx } from './tx.js';
import { PublicKey } from './crypto/pubkey.js';

export { NetworkConfig };

/** A signer represents a wallet or another provider that can sign transactions. Typically, a signer
 * has multiple accounts for different networks, sometimes even for the same network. A Signer
 * implementation should cache the SignData for each network and keep their sequence numbers up to date.
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

  /** Sign a transaction. */
  sign(network: NetworkConfig, tx: Tx): Promise<Tx>;

  /** Broadcast a signed transaction. Returns the tx hash if successful. */
  broadcast(tx: Tx): Promise<string>;

  /** Get the addresses for the given networks. If no networks are provided, returns the addresses of all connected networks. */
  addresses(networks?: NetworkConfig[]): string[];

  /** Get the address for the given network. If no network is provided, returns the address of the currently bound network. */
  address(network: NetworkConfig): string;

  /** Get the signer data necessary to sign a transaction for a specific network. */
  getSignData(network: NetworkConfig): SignData;

  /** Get a signal representing whether this Signer is available. This signal should be updated during a call to `.probe()`. */
  get available(): Signal<boolean>;
  /** Get the sign data for the current network, if any. This is intended for use in UIs primarily. In business logic, prefer `.getSignData()`. */
  get signData(): Signal<SignData | undefined>;
}

export interface SignData {
  address: string;
  publicKey: PublicKey;
  /** The sequence number of this account to prevent replay attacks. If 0, the account has never
   * created a transaction before.
   */
  sequence: bigint;
  /** The account number of this account as registered on the chain. If 0, the account has never
   * been seen on-chain before and must first be funded. Upon funding, the account receives a number
   * and can henceforth be used as a signer.
   */
  accountNumber: bigint;
}

export type Loading<T> = ({ loading: true } & Partial<T>) | ({ loading: false } & T);
