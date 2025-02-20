import { endpoints, type CosmosNetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { Cosmos, CosmosTx, CosmosTxDirect, TxMarshaller } from '@apophis-sdk/cosmos';
import { CosmosSigner } from '@apophis-sdk/cosmos/signer.js';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { AuthInfo, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';
import LOGO_DATA_URL from './logo';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

var signers: Array<WeakRef<KeplrSigner>> = [];

export class KeplrSigner extends CosmosSigner {
  readonly type = 'Keplr';
  readonly displayName = 'Keplr';
  readonly logoURL = LOGO_DATA_URL;

  readonly canAutoReconnect = true;

  constructor() {
    super();
    this.available.value = isAvailable();
    signers.push(new WeakRef(this));
  }

  probe(): Promise<boolean> {
    return Promise.resolve(this.available.value = isAvailable());
  }

  async connect(networks: CosmosNetworkConfig[]) {
    if (!window.keplr) throw new Error('Keplr not available');
    if (!networks.length) throw new Error('No networks provided');
    await Promise.all(networks.map((network) => window.keplr?.experimentalSuggestChain(toChainSuggestion(network))));
    await window.keplr.enable(networks.map((network) => network.chainId));
    await this.loadSignData(networks);
    Cosmos.watchSigner(this);
  }

  async broadcast(tx: CosmosTx): Promise<string> {
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

  /** Load `SignData` for the given networks. This is intended for internal use only and will be
   * automatically called by the integration.
   */
  async loadSignData(networks?: CosmosNetworkConfig[]) {
    await this._initSignData(networks ?? this.networks.value);
  }

  protected async getAccounts(network: CosmosNetworkConfig): Promise<{ address: string; publicKey: PublicKey }[]> {
    const offlineSigner = window.keplr!.getOfflineSigner(network.chainId);
    return (await offlineSigner.getAccounts())
      .filter(account => account.algo === 'secp256k1' || account.algo === 'ed25519')
      .map(account => ({
        address: account.address,
        publicKey: account.algo === 'secp256k1'
          ? pubkey.secp256k1(account.pubkey)
          : pubkey.ed25519(account.pubkey),
      }));
  }

  async sign(network: CosmosNetworkConfig, tx: CosmosTx): Promise<CosmosTx> {
    const { address, publicKey } = this.getSignData(network)[0];
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
  window.addEventListener('keplr_keystorechange', () => {
    signers = signers.filter(s => !!s.deref());
    for (const signer of signers) {
      signer.deref()!.loadSignData();
    }
  });
}

function isAvailable() {
  return !!window.keplr && window.keplr !== (window as any).leap;
}
