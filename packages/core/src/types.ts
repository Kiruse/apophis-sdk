import { Signal } from '@preact/signals-core';
import type { NetworkConfig } from './networks.js';
import type { Tx } from './tx.js';
import { PublicKey } from './crypto/pubkey.js';

export { NetworkConfig };

export interface ApophisConfig {
  /** Multiplier for the gas fee estimate to avoid under-estimation. Should generally be held low
   * to avoid overspending as, unlike Ethereum chains, Cosmos chains do not refund unused gas.
   */
  gasFactor: number;
}

export type Loading<T> = ({ loading: true } & Partial<T>) | ({ loading: false } & T);
