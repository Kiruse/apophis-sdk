import { type NetworkConfig, type SignData, Signer } from '@apophis-sdk/core';
import { Cosmos } from './api.js';
import { CosmosTx } from './tx';

/** Specialization of the Signer class for Cosmos SDK-based chains. */
export abstract class CosmosSigner extends Signer<CosmosTx> {
  /** Signer implementations should call this method at the end of their `connect` implementation.
   * This method initializes the SignData for each network and registers the signer with the Cosmos
   * API for monitoring account changes. It is safe to call this method multiple times, although you
   * should avoid it.
   */
  protected async _initSignData(networks: NetworkConfig[]) {
    const result = new Map<NetworkConfig, SignData[]>();
    await Promise.all(networks.map(async network => {
      const signDatas: SignData[] = result.get(network) ?? [];
      const accounts = await this.getAccounts(network);
      for (const { address, publicKey } of accounts) {
        const { accountNumber, sequence } = await Cosmos.getAccountInfo(network, address).catch(() => ({ accountNumber: 0n, sequence: 0n }));
        signDatas.push({ address, publicKey, accountNumber, sequence });
      }
      result.set(network, signDatas);
    }));
    this.signDatas.value = result;
  }
}
