import { getRest, getRpc, type Account, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { toHex } from '@apophis-sdk/core/utils.js';
import { BroadcastMode, type Window as KeplrWindow } from '@keplr-wallet/types';
import { signal } from '@preact/signals-core';
import LOGO_DATA_URL from './logo';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

export abstract class KeplrSignerBase implements Signer {
  #available = signal(!!window.keplr);

  abstract get type(): string;
  get displayName() { return 'Keplr' }
  get logoURL() { return LOGO_DATA_URL }

  probe(): Promise<boolean> {
    return Promise.resolve(this.#available.value = !!window.keplr);
  }

  async connect(networks: NetworkConfig[]) {
    if (!window.keplr) throw new Error('Keplr not available');
    await Promise.all(networks.map((network) => window.keplr?.experimentalSuggestChain(toChainSuggestion(network))));
    // TODO: suggest chains
    await window.keplr.enable(networks.map((network) => network.chainId));
  }

  abstract account(): Account;

  async broadcast(tx: Tx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    try {
      const hashbytes = await window.keplr!.sendTx(network.chainId, tx.bytes(), BroadcastMode.Async);
      const hash = toHex(hashbytes);
      tx.confirm(hash);
      return hash;
    } catch (error: any) {
      tx.reject(tx.hash!, error);
      throw error;
    }
  }

  countAccounts(network: NetworkConfig): Promise<number> {
    if (!window.keplr) throw new Error('Keplr not available');
    const signer = window.keplr.getOfflineSigner(network.chainId);
    return signer.getAccounts().then((accounts) => accounts.length);
  }

  get available() { return this.#available }
}

function toChainSuggestion(network: NetworkConfig): Parameters<Required<KeplrWindow>['keplr']['experimentalSuggestChain']>[0] {
  return {
    chainId: network.chainId,
    chainName: network.prettyName,
    rpc: getRpc(network)!,
    rest: getRest(network)!,
    bip44: {
      coinType: network.slip44!,
    },
    currencies: network.assets.map(asset => ({
      coinDenom: asset.denom,
      coinMinimalDenom: asset.denom,
      coinDecimals: asset.decimals ?? 6,
      coinGeckoId: asset.cgid,
    })),
    feeCurrencies: network.gas.map(cfg => ({
      coinDenom: cfg.asset.denom,
      coinDecimals: cfg.asset.decimals ?? 6,
      coinMinimalDenom: cfg.asset.denom,
      coinGeckoId: cfg.asset.cgid,
      gasPriceStep: {
        low: parseFloat(cfg.lowPrice?.toString() ?? cfg.avgPrice.toString()),
        average: parseFloat(cfg.avgPrice.toString()),
        high: parseFloat(cfg.highPrice?.toString() ?? cfg.avgPrice.toString()),
      },
    })),
    bech32Config: {
      bech32PrefixAccAddr: network.addressPrefix,
      bech32PrefixAccPub: network.addressPrefix + 'pub',
      bech32PrefixValAddr: network.addressPrefix + 'valoper',
      bech32PrefixValPub: network.addressPrefix + 'valoperpub',
      bech32PrefixConsAddr: network.addressPrefix + 'valcons',
      bech32PrefixConsPub: network.addressPrefix + 'valconspub',
    },
    stakeCurrency: network.staking ? {
      coinDenom: network.staking.denom,
      coinMinimalDenom: network.staking.denom,
      coinDecimals: network.staking.decimals ?? 6,
      coinGeckoId: network.staking.cgid,
    } : undefined,
  };
}
