import type { NetworkConfig } from './networks.js';
import type { Signer } from './signer.js';

export { NetworkConfig };

export interface ApophisConfig {
  /** Multiplier for the gas fee estimate to avoid under-estimation. Should generally be held low
   * to avoid overspending as, unlike Ethereum chains, Cosmos chains do not refund unused gas.
   */
  gasFactor: number;
}

export type Loading<T> = ({ loading: true } & Partial<T>) | ({ loading: false } & T);

/** The ecosystem a transaction, wallet, or API belongs to. The possible values are the currently only supported ecosystems. */
export type Ecosystem = 'cosmos' | 'solana';
export type TxStatus = 'unsigned' | 'signed' | 'confirmed' | 'failed';

export interface TxBase {
  get ecosystem(): Ecosystem;
  get status(): TxStatus;
  get signer(): Signer | undefined;
  get signature(): Uint8Array | undefined;
  get network(): NetworkConfig | undefined;
  get hash(): string | undefined;
  get error(): string | undefined;

  setSignature(network: NetworkConfig, signer: Signer<any>, signature: Uint8Array): this;
  /** Update internal state to indicate that the transaction was confirmed. */
  confirm(hash: string): void;
  /** Update internal state to indicate that the transaction failed. */
  reject(hash: string, error: string): void;

  /** Broadcast this transaction to the network. */
  broadcast(): Promise<string>;
}

