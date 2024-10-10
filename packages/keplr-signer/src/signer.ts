import { connections, Cosmos, type NetworkConfig, Signer } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Tx } from '@apophis-sdk/core/tx.js';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { type Window as KeplrWindow } from '@keplr-wallet/types';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';
import LOGO_DATA_URL from './logo';

declare global {
  interface Window {
    keplr: KeplrWindow['keplr'];
  }
}

var signers: Array<WeakRef<KeplrSignerBase>> = [];

export abstract class KeplrSignerBase extends Signer {
  readonly canAutoReconnect = true;

  constructor() {
    super();
    this.available.value = isAvailable();
    signers.push(new WeakRef(this));
  }

  abstract get type(): string;
  get displayName() { return 'Keplr' }
  get logoURL() { return LOGO_DATA_URL }

  probe(): Promise<boolean> {
    return Promise.resolve(this.available.value = isAvailable());
  }

  async connect(networks: NetworkConfig[]) {
    if (!window.keplr) throw new Error('Keplr not available');
    if (!networks.length) throw new Error('No networks provided');
    await Promise.all(networks.map((network) => window.keplr?.experimentalSuggestChain(toChainSuggestion(network))));
    await window.keplr.enable(networks.map((network) => network.chainId));
    await this.loadSignData(networks);
    Cosmos.watchSigner(this);
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

  /** Load `SignData` for the given networks. This is intended for internal use only and will be
   * automatically called by the integration.
   */
  async loadSignData(networks?: NetworkConfig[]) {
    await this._initSignData(networks ?? this.networks.value);
  }

  protected async getAccounts(network: NetworkConfig): Promise<{ address: string; publicKey: PublicKey }[]> {
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
export class KeplrDirectSigner extends KeplrSignerBase {
  readonly type = 'Keplr.Direct';

  async sign(network: NetworkConfig, tx: Tx): Promise<Tx> {
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
/** Instance of KeplrDirectSigner. Most likely the only instance you'll need. */
export const KeplrDirect = new KeplrDirectSigner();

function toChainSuggestion(network: NetworkConfig): Parameters<Required<KeplrWindow>['keplr']['experimentalSuggestChain']>[0] {
  return {
    chainId: network.chainId,
    chainName: network.prettyName,
    rpc: network.name.match(/testnet|devnet/) ? connections.rpc(network)[0] : `https://rpc.cosmos.directory/${network.name}`,
    rest: network.name.match(/testnet|devnet/) ? connections.rest(network)[0] : `https://rest.cosmos.directory/${network.name}`,
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
