import { Cosmos, getRest, getRpc, signals, SignData, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Tx } from '@apophis-sdk/core/tx.js';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { signal } from '@preact/signals-core';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';
import LOGO_DATA_URL from './logo';

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
    if (!networks.length) throw new Error('No networks provided');
    await Promise.all(networks.map((network) => window.keplr?.experimentalSuggestChain(toChainSuggestion(network))));
    await window.keplr.enable(networks.map((network) => network.chainId));

    await this.loadSignData(networks);
    this.signData.value = this.getSignData(signals.network.value ?? networks[0]);

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
    return this.getSignData(network).address;
  }

  /** Load `SignData` for the given networks. This is intended for internal use only and will be
   * automatically called by the integration.
   */
  async loadSignData(networks?: NetworkConfig[]) {
    networks ??= Array.from(this.#signData.keys());

    await Promise.all(networks.map(async network => {
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
    }));
  }

  isConnected(network: NetworkConfig): boolean {
    return this.#signData.has(network);
  }
}

/** Keplr Direct Signer.
 *
 * In Cosmos, there are currently two data formats for transactions: Amino and Protobuf aka Direct.
 * Amino is the legacy format and is being phased out in favor of Protobuf. It is still highly
 * relevant as the Cosmos Ledger Micro-App currently only supports Amino. It is also the reason why
 * many modern Dapps leveraging modern Cosmos SDK modules which do not support Amino are incompatible
 * with Ledger.
 *
 * When detecting, you need to check only one of `await KeplrDirect.probe()` or `await KeplrAmino.probe()`
 * as they abstract the same interface.
 */
export const KeplrDirect = new class extends KeplrSignerBase {
  readonly type = 'Keplr.Direct';

  async sign(network: NetworkConfig, tx: Tx): Promise<Tx> {
    const { address, publicKey } = this.getSignData(network);
    if (!window.keplr) throw new Error('Keplr not available');
    if (!address || !publicKey || !network) throw new Error('Account not bound to a network');

    const signer = await window.keplr.getOfflineSigner(network.chainId);
    const signDoc = tx.signDoc(network, this);
    const keplrSignDoc = {
      ...signDoc,
      accountNumber: Long.fromValue(signDoc.accountNumber.toString()),
    };

    const {
      signed,
      signature: { signature },
    } = await signer.signDirect(address, keplrSignDoc);

    const body = TxBody.decode(signed.bodyBytes);
    tx.memo = body.memo;
    tx.extensionOptions = body.extensionOptions;
    tx.nonCriticalExtensionOptions = body.nonCriticalExtensionOptions;
    tx.timeoutHeight = body.timeoutHeight;

    const authInfo = AuthInfo.decode(signed.authInfoBytes);
    tx.gas = {
      amount: authInfo.fee!.amount,
      gasLimit: authInfo.fee!.gasLimit,
      granter: authInfo.fee!.granter,
      payer: authInfo.fee!.payer,
    };

    tx.setSignature(network, this, fromBase64(signature));
    return tx;
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
    if (!network || !signer.isConnected(network)) {
      signer.signData.value = undefined;
    } else {
      signer.signData.value = signer.getSignData(network);
    }
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
