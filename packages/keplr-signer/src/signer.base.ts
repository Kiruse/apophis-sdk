import { Cosmos, getRest, getRpc, signals, SignData, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { toHex } from '@apophis-sdk/core/utils.js';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { signal } from '@preact/signals-core';
import LOGO_DATA_URL from './logo';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

const signers: Array<WeakRef<KeplrSignerBase>> = [];

export abstract class KeplrSignerBase implements Signer {
  readonly available = signal(!!window.keplr);
  readonly signData = signal<SignData | undefined>();
  #signData = new Map<NetworkConfig, SignData>();

  constructor() {
    signers.push(new WeakRef(this));
  }

  abstract get type(): string;
  get displayName() { return 'Keplr' }
  get logoURL() { return LOGO_DATA_URL }

  probe(): Promise<boolean> {
    return Promise.resolve(this.available.value = !!window.keplr);
  }

  async connect(networks: NetworkConfig[]) {
    if (!window.keplr) throw new Error('Keplr not available');
    await Promise.all(networks.map((network) => window.keplr?.experimentalSuggestChain(toChainSuggestion(network))));
    await window.keplr.enable(networks.map((network) => network.chainId));

    await this.loadSignData(networks);

    for (const network of networks) {
      if (!this.#signData.has(network)) {
        Cosmos.ws(network).onBlock(async block => {
          const values = Cosmos.getEventValues(block.events, 'message', 'sender');
          if (values.includes(this.address(network))) {
            const { sequence } = await Cosmos.getAccountInfo(network, this.address(network));
            this.#signData.set(network, {
              ...this.#signData.get(network)!,
              sequence,
            });
          }
        })
      }
    }
  }

  abstract sign(network: NetworkConfig, tx: Tx): Promise<Tx>;

  async broadcast(tx: Tx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    try {
      // note: enum not found in bundle, apparently, so screw it
      const hashbytes = await window.keplr!.sendTx(network.chainId, tx.bytes(), 'sync' as any);
      const hash = toHex(hashbytes);
      tx.confirm(hash);
      return hash;
    } catch (error: any) {
      tx.reject(tx.hash!, error);
      throw error;
    }
  }

  getSignData(network: NetworkConfig): SignData {
    const data = this.#signData.get(network);
    if (!data) throw new Error('Account not found');
    return data;
  }

  addresses(networks?: NetworkConfig[]): string[] {
    if (!networks) return Array.from(this.#signData.values()).map(data => data.address);
    return networks.map(network => this.address(network));
  }

  address(network: NetworkConfig): string {
    const data = this.#signData.get(network);
    if (!data) throw new Error('Account not found');
    return data.address;
  }

  /** Load `SignData` for the given networks. This is intended for internal use only and will be
   * automatically called by the integration.
   */
  async loadSignData(networks?: NetworkConfig[]) {
    networks ??= Array.from(this.#signData.keys());

    for (const network of networks) {
      const offlineSigner = window.keplr!.getOfflineSigner(network.chainId);
      const accounts = await offlineSigner.getAccounts();
      await Promise.all(accounts.map(async account => {
        const { algo, address, pubkey: publicKey } = account;
        if (algo !== 'secp256k1' && algo !== 'ed25519') throw new Error('Unsupported algorithm');

        const { sequence, accountNumber } = await Cosmos.getAccountInfo(network, address).catch(() => ({ sequence: 0n, accountNumber: 0n }));

        this.#signData.set(network, {
          address,
          publicKey: algo === 'secp256k1'
            ? pubkey.secp256k1(publicKey)
            : pubkey.ed25519(publicKey),
          sequence,
          accountNumber,
        });
      }));
    }
  }
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

signals.network.subscribe(network => {
  for (const ref of signers) {
    const signer = ref.deref();
    if (!signer) continue;
    signer.signData.value = network && signer.getSignData(network);
  }
  purgeRefs();
});

if (typeof window !== 'undefined') {
  window.addEventListener('keplr_keystorechange', () => {
    for (const ref of signers) {
      const signer = ref.deref();
      if (!signer) continue;
      signer.loadSignData();
    }
  });
}

function purgeRefs() {
  for (let i = 0; i < signers.length; ++i) {
    const ref = signers[i];
    if (!ref.deref()) {
      signers.splice(i, 1);
      --i;
    }
  }
}
