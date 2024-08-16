import type { Event } from '@kiruse/typed-events';
import type { TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import type { Account } from './account';
import type { Ecosystem, Unregistered } from './constants';
import type Tx from './tx';
import { Signal } from '@preact/signals-core';

export interface NetworkConfig {
  chainId: string;
  prettyName: string;
  /** The unique registry name. */
  name: string | Unregistered;
  eco: Ecosystem;
  /** An optional prefix that should be ignored when shortening addresses in the UI. */
  addressPrefix?: string;
}

export type ChainIDish = string | NetworkConfig;

/** Represents a block in the Cosmos ecosystem. */
export interface Block<Raw = unknown> {
  /** Height of this block. */
  height: number;
  /** Hash of the entire block. */
  hash: string;
  /** Timestamp of this block. */
  time: Date;
  /** The raw block data. */
  raw: Raw;
}

/** Represents a single transaction of many within a block in the Cosmos ecosystem. */
export interface Transaction<Raw = unknown> {
  blockHeight: number;
  hash: string;
  /** The raw transaction data. */
  raw: Raw;
}

/** Cosmos clients provide read-only access to Cosmos blockchains. */
export interface CosmosClient {
  readonly on: CosmosClientEvents;

  /** Query the current block height. */
  height(): Promise<bigint>;

  /** Query the block at the given height. */
  block(height: number | bigint): Promise<Block>;

  /** Query the transaction bytes of the given transaction hash. */
  tx(hash: string): Promise<Transaction>;
}

export interface CosmosClientEvents {
  block: Event<Block>;
}

/** Signers provide write access to on-chain data. They do not provide read access. They allow
 * passing messages to the user for signing, and then broadcasting these signed messages to the
 * blockchain network.
 */
export interface Signer<Payload> {
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
  account(): Account<Tx<Payload>>;

  /** Create a new unsigned transaction. This transaction will then need to be signed by an `Account`,
   * returned by `signer.account()`, before it can be `.broadcast()`ed.
   */
  tx(body: Payload): Tx<Payload>;

  /** Count how many accounts this signer tracks. Not every signer may actually track this value and may thus throw. */
  countAccounts(network: NetworkConfig): Promise<number>;

  /** Get a signal representing whether this Signer is available. This signal should be updated during a call to `.probe()`. */
  get available(): Signal<boolean>;
}

export type DirectSignerPayload = TxBody;
export type DirectSigner = Signer<DirectSignerPayload>;

export type Loading<T> = ({ loading: true } & Partial<T>) | ({ loading: false } & T);
