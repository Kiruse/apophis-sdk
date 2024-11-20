import { endpoints, type NetworkConfig } from '@apophis-sdk/core';
import { Cosmos, CosmosSigner, CosmosTx } from '@apophis-sdk/cosmos';
import { BroadcastMode } from '@apophis-sdk/core/types.sdk.js';
import { addresses } from '@apophis-sdk/core/address.js';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist as _wordlist } from '@scure/bip39/wordlists/english';
import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

secp256k1.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp256k1.etc.concatBytes(...m));

export class LocalSigner extends CosmosSigner {
  static readonly instance = new LocalSigner();

  #privateKey: Uint8Array | undefined;
  #seed: Uint8Array | undefined;
  readonly type = 'local';
  readonly canAutoReconnect = true;
  readonly displayName = 'Local';
  readonly logoURL = undefined;

  setPrivateKey(privateKey: Uint8Array) {
    if (privateKey.length !== 32) throw new Error('Invalid private key length');
    this.#privateKey = privateKey;
    return this;
  }

  setSeed(seed: Uint8Array) {
    if (seed.length !== 64) throw new Error('Invalid seed length');
    this.#seed = seed;
    return this;
  }

  probe(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async connect(networks: NetworkConfig[]) {
    await this._initSignData(networks);
    Cosmos.watchSigner(this);
  }

  async sign(network: NetworkConfig, tx: CosmosTx): Promise<CosmosTx> {
    if (network.ecosystem !== 'cosmos') throw new Error('Currently, only Cosmos chains are supported');
    const bytes = tx.signBytes(network, this);
    const signature = secp256k1.sign(bytes, this.#getPrivateKey(network));
    const sigBytes = signature.toCompactRawBytes();
    if (sigBytes.length !== 64) throw new Error('Invalid signature length');
    if (!secp256k1.verify(sigBytes, bytes, this.getSignData(network)[0].publicKey.key, { lowS: true }))
      throw new Error('Invalid signature');

    tx.setSignature(network, this, sigBytes);
    return tx;
  }

  async broadcast(tx: CosmosTx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    const url = endpoints.get(network, 'rest');
    if (!url) throw new Error('No REST endpoint available');

    const { tx_response: response } = await Cosmos.rest(network).cosmos.tx.v1beta1.txs('POST', { mode: BroadcastMode.BROADCAST_MODE_SYNC, tx_bytes: tx.bytes() });
    if (response.code) {
      tx.reject(response.txhash, response.raw_log);
    } else {
      tx.confirm(response.txhash);
    }
    return response.txhash;
  }

  protected async getAccounts(network: NetworkConfig): Promise<{ address: string; publicKey: PublicKey; }[]> {
    const priv = this.#getPrivateKey(network);
    const pub = pubkey.secp256k1(secp256k1.getPublicKey(priv, true));
    return [{ address: addresses.compute(network, pub), publicKey: pub }];
  }

  #getPrivateKey(network: NetworkConfig, accountIndex = 0, addressIndex = 0) {
    if (network.ecosystem !== 'cosmos') throw new Error('Currently, only Cosmos chains are supported');
    if (this.#privateKey) return this.#privateKey;
    if (!this.#seed) throw new Error('No private key or mnemonic/seed set');
    const key = bip32.HDKey.fromMasterSeed(this.#seed).derive(`m/44'/${network.slip44 ?? 118}'/${accountIndex}'/0/${addressIndex}`);
    if (!key.privateKey) throw new Error('Failed to derive private key');
    return key.privateKey;
  }

  static generateMnemonic(wordlist = _wordlist, strength = 256) {
    return bip39.generateMnemonic(wordlist, strength);
  }

  static generatePrivateKey() {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  static async fromMnemonic(mnemonic: string, passphrase?: string, wordlist = _wordlist) {
    if (!bip39.validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
    return new LocalSigner().setSeed(seed);
  }

  static fromPrivateKey(privateKey: Uint8Array) {
    return new LocalSigner().setPrivateKey(privateKey);
  }
}
