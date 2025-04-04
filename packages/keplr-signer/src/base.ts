import { endpoints, ExternalAccount, Signer, type CosmosNetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { Cosmos, CosmosTx, CosmosTxDirect, TxMarshaller } from '@apophis-sdk/cosmos';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';
import LOGO_DATA_URL from './logos/keplr';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

var signers = new Set<WeakRef<KeplrSigner>>();
const FAKERS = ['leap'];

export class KeplrSigner extends Signer<CosmosTx> {
  #networks: CosmosNetworkConfig[] = [];
  get type() { return 'Keplr' }
  get displayName() { return 'Keplr' }
  get logoURL() { return LOGO_DATA_URL }
  get canAutoReconnect() { return true }

  constructor() {
    super();
    this.available.value = this.keplrProbe();
    signers.add(new WeakRef(this));
  }

  /** Internal non-async method to prove for presence of Keplr. Can be overridden by Keplr fork integrations like Leap. */
  keplrProbe(): boolean {
    return !!window.keplr && !FAKERS.some(f => window.keplr === (window as any)[f]);
  }

  probe(): Promise<boolean> {
    return Promise.resolve(this.available.value = this.keplrProbe());
  }

  async connect(networks: CosmosNetworkConfig[]): Promise<ExternalAccount[]> {
    const backend = this.backend;
    if (!backend) throw new Error('Keplr not available');
    if (!networks.length) throw new Error('No networks provided');
    this.#networks = networks;
    await Promise.all(networks.map((network) => backend.experimentalSuggestChain(toChainSuggestion(network))));
    await backend.enable(networks.map((network) => network.chainId));

    for (const network of networks) {
      const pks = await this.getPublicKeys([network]);
      await this.initAccounts(network, pks);
    }

    await this.updateSignData(networks);
    return this.accounts.peek();
  }

  async broadcast(tx: CosmosTx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    try {
      // note: enum not found in bundle, apparently, so screw it
      const hashbytes = await this.backend!.sendTx(network.chainId, tx.bytes(), 'sync' as any);
      const hash = toHex(hashbytes);
      tx.confirm(hash);
      return hash;
    } catch (error: any) {
      tx.reject(tx.hash!, error);
      throw error;
    }
  }

  /** Load `SignData` for the given networks. This is intended for internal use only and will be
   * automatically called by the integration.
   */
  async updateSignData(networks = this.#networks): Promise<ExternalAccount[]> {
    const pubkeys = await this.getPublicKeys(networks);

    return await Promise.all(pubkeys.map(async pubkey => {
      const account = new ExternalAccount(pubkey);
      await account.update(networks);
      return account;
    })).then(accs => accs.flat());
  }

  /** Get the accounts from Keplr. Generally not needed, as you will use the `accounts` signal instead. */
  async getAccounts(network: CosmosNetworkConfig): Promise<{ address: string; publicKey: PublicKey }[]> {
    const offlineSigner = this.backend!.getOfflineSigner(network.chainId);
    return (await offlineSigner.getAccounts())
      .filter(account => account.algo === 'secp256k1' || account.algo === 'ed25519')
      .map(account => ({
        address: account.address,
        publicKey: account.algo === 'secp256k1'
          ? pubkey.secp256k1(account.pubkey)
          : pubkey.ed25519(account.pubkey),
      }));
  }

  /** Get all unique public keys across all accounts & across the given networks.
   *
   * Often, the same public key is used across multiple networks, so this method
   * dedupes the public keys.
   */
  async getPublicKeys(networks: CosmosNetworkConfig[]): Promise<PublicKey[]> {
    const map: Record<string, PublicKey> = {};
    const infos = await Promise.all(networks.map(network => this.getAccounts(network)))
      .then(infos => infos.flat());

    for (const { publicKey: pub } of infos) {
      const bs = typeof pub.bytes === 'string' ? pub.bytes : toHex(pub.bytes);
      const key = `${pub.type}:${bs}`;
      if (map[key]) continue;
      map[key] = pub;
    }

    return Object.values(map);
  }

  async sign(network: CosmosNetworkConfig, tx: CosmosTx): Promise<CosmosTx> {
    const signData = this.getSignData(network);
    if (!ExternalAccount.isComplete(signData)) throw new Error('Sign data incomplete');
    const { address, publicKey } = signData;
    if (!this.backend) throw new Error('Keplr not available');
    if (!address || !publicKey || !network) throw new Error('Account not bound to a network');

    const signer = await this.backend.getOfflineSigner(network.chainId);
    const signDoc = tx.signDoc(network, this);
    const keplrSignDoc = {
      ...signDoc,
      accountNumber: Long.fromValue(signDoc.accountNumber.toString()),
    };

    const {
      signed,
      signature: { signature },
    } = await signer.signDirect(address, TxMarshaller.marshal(keplrSignDoc) as any);

    const body = TxBody.decode(signed.bodyBytes);
    tx.memo = body.memo;
    if (tx instanceof CosmosTxDirect) {
      tx.extensionOptions = body.extensionOptions;
      tx.nonCriticalExtensionOptions = body.nonCriticalExtensionOptions;
    }
    tx.timeoutHeight = body.timeoutHeight;

    const authInfo = AuthInfo.decode(signed.authInfoBytes);
    tx.gas = {
      amount: authInfo.fee!.amount.map(coin => Cosmos.coin(coin.amount, coin.denom)),
      gasLimit: authInfo.fee!.gasLimit,
      granter: authInfo.fee!.granter,
      payer: authInfo.fee!.payer,
    };

    tx.setSignature(network, this, fromBase64(signature));
    return tx;
  }

  /** Get the Keplr instance. Primarily used internally. */
  get backend() {
    return window.keplr;
  }

  /** Update all created & non-gcc'ed signers. Run automatically every 30s and when the keystore changes. */
  static async updateAll() {
    for (const signer of getSigners()) {
      await signer.updateSignData();
    }
  }
}

export const Keplr = new KeplrSigner();

/** @deprecated Use `Keplr` instead. There is no difference between Direct and Amino signers in Apophis. */
export const KeplrDirect = Keplr;

function toChainSuggestion(network: CosmosNetworkConfig): Parameters<Required<KeplrWindow>['keplr']['experimentalSuggestChain']>[0] {
  return {
    chainId: network.chainId,
    chainName: network.prettyName,
    rpc: endpoints.get(network, 'rpc'),
    rest: endpoints.get(network, 'rest'),
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

// Update all signers when the keystore changes
if (typeof window !== 'undefined') {
  window.addEventListener('keplr_keystorechange', KeplrSigner.updateAll);
}

// Update all signers periodically
setInterval(KeplrSigner.updateAll, 30000);

function getSigners() {
  const result: KeplrSigner[] = [];
  for (const signer of signers) {
    const s = signer.deref();
    if (s) {
      result.push(s);
    } else {
      signers.delete(signer);
    }
  }
  return result;
}
