import type { Signer } from './types';

/** Marks a `Network` as unregistered, i.e. either this ecosystem does not have a de facto official
 * chain registry, or the network is not registered in its de facto chain registry.
 */
export const Unregistered = '@@Unregistered@@';
export type Unregistered = typeof Unregistered;

/** Ecosystem of a blockchain. */
export enum Ecosystem {
  /** Standalone Ecosystem, i.e. the chain is not associated with similar blockchains. */
  Standalone = 'standalone',
  Cosmos = 'cosmos',
  // Ethereum = 'ethereum',
  // Solana = 'solana',
}

/** Array of registered signers. Can be used to iterate over the various imported integrations to check for availability. */
export const signers: Signer<unknown>[] = [];
