import { CosmosNetworkConfig, endpoints, ExternalAccount, ExternalAccountMap, Signer, type NetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { BroadcastMode } from '@apophis-sdk/core/types.sdk.js';
import * as utils from '@apophis-sdk/core/utils.js';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist as _wordlist } from '@scure/bip39/wordlists/english';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { Cosmos } from './api.js';
import { CosmosTx } from './tx.js';

if (!secp256k1.hashes.hmacSha256)
  secp256k1.hashes.hmacSha256 = (key, msg) => hmac(sha256, key, msg);
if (!secp256k1.hashes.sha256)
  secp256k1.hashes.sha256 = sha256;

var signers = new Set<WeakRef<LocalSigner>>();

export class LocalSigner extends Signer<CosmosTx> {
  static readonly instance = new LocalSigner();

  #privateKey: Uint8Array | undefined;
  #seed: Uint8Array | undefined;
  #networks: CosmosNetworkConfig[] = [];
  readonly type = 'local';
  readonly canAutoReconnect = true;
  readonly displayName = 'Local';
  readonly logoURL = undefined;
  /** Whether to automatically update sign data before signing. Set to false if you intend to manage
   * the sequence number manually.
   */
  autoUpdateSignData = true;

  constructor() {
    super();
    signers.add(new WeakRef(this));
  }

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

  async connect(networks: CosmosNetworkConfig[]): Promise<ExternalAccount[]> {
    if (!networks.length) throw new Error('No networks provided');
    this.#networks = networks;
    const accounts: ExternalAccountMap = {};
    for (const network of networks) {
      this.initAccounts(accounts, network, [this.getPublicKey(network)]);
    }
    this.accounts.value = Object.values(accounts);
    await this.updateSignData(networks);
    return this.accounts.peek();
  }

  /** Update sign data of all accounts on the given networks. Assumes that the `accounts` have already been initialized. */
  async updateSignData(networks = this.#networks): Promise<ExternalAccount[]> {
    const accounts = this.accounts.peek();
    await Promise.all(accounts.map(acc => acc.update(networks)));
    return accounts.flat();
  }

  async sign(network: NetworkConfig, tx: CosmosTx): Promise<CosmosTx> {
    if (network.ecosystem !== 'cosmos') throw new Error('Currently, only Cosmos chains are supported');

    // Always update sign data before signing to ensure we have the latest sequence number
    if (this.autoUpdateSignData)
      await this.updateSignData([network]);

    const bs = tx.signBytes(network, this);
    const opts = { prehash: false, lowS: true };
    const sigBytes = secp256k1.sign(bs, this.#getPrivateKey(network), opts);
    if (sigBytes.length !== 64) throw new Error('Invalid signature length');
    if (!secp256k1.verify(sigBytes, bs, utils.bytes(this.getPublicKey(network).bytes), opts))
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
      throw new Error(`Transaction rejected with codespace ${response.codespace}, code ${response.code}, raw log: ${response.raw_log}`);
    } else {
      tx.confirm(response.txhash);
    }
    return response.txhash;
  }

  #getPrivateKey(network: NetworkConfig, accountIndex = 0, addressIndex = 0) {
    if (network.ecosystem !== 'cosmos') throw new Error('Currently, only Cosmos chains are supported');
    if (this.#privateKey) return this.#privateKey;
    if (!this.#seed) throw new Error('No private key or mnemonic/seed set');
    const key = bip32.HDKey.fromMasterSeed(this.#seed).derive(`m/44'/${network.slip44 ?? 118}'/${accountIndex}'/0/${addressIndex}`);
    if (!key.privateKey) throw new Error('Failed to derive private key');
    return key.privateKey;
  }

  getPublicKey(network: NetworkConfig, accountIndex = 0, addressIndex = 0) {
    const priv = this.#getPrivateKey(network, accountIndex, addressIndex);
    return pubkey.secp256k1(secp256k1.getPublicKey(priv, true));
  }

  getPublicKeys(networks: NetworkConfig[]) {
    const keys: Record<string, PublicKey> = {};
    for (const network of networks) {
      const pub = this.getPublicKey(network);
      const bs = typeof pub.bytes === 'string' ? pub.bytes : utils.toBase64(pub.bytes);
      const key = `${pub.type}:${bs}`;
      keys[key] = pub;
    }
    return Object.values(keys);
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
