import { computed, signal } from '@preact/signals-core';
import { Cosmos, getRest, signals, SignData, type NetworkConfig, type Signer } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { BroadcastMode } from '@apophis-sdk/core/types.sdk.js';
import { getAddress } from '@apophis-sdk/core/utils.js';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist as _wordlist } from '@scure/bip39/wordlists/english';
import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

secp256k1.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp256k1.etc.concatBytes(...m));

export const LocalSigner = new class implements Signer {
  #networks: NetworkConfig[] = [];
  #privateKey: Uint8Array | undefined;
  #mnemonic: string | undefined;
  #signData = new Map<NetworkConfig, SignData>();
  readonly type = 'local';
  readonly available = signal(false);
  readonly displayName = 'Local';
  readonly logoURL = undefined;
  readonly signData = computed(() => signals.network.value ? this.getSignData(signals.network.value) : undefined);

  setPrivateKey(privateKey: Uint8Array) {
    if (privateKey.length !== 32) throw new Error('Invalid private key length');
    this.#privateKey = privateKey;
    return this;
  }

  setMnemonic(mnemonic: string, wordlist = _wordlist) {
    mnemonic = mnemonic.trim();
    if (!bip39.validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
    this.#mnemonic = mnemonic;
    return this;
  }

  probe(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async connect(networks: NetworkConfig[]): Promise<void> {
    this.#networks = networks;

    await Promise.all(networks.map(async network => {
      const priv = this.#getPrivateKey(network);
      const pub = pubkey.secp256k1(secp256k1.getPublicKey(priv, true));
      const signData = await Cosmos.watchSignData(network, pub);
      this.#signData.set(network, signData);
    }));

    return Promise.resolve();
  }

  async sign(network: NetworkConfig, tx: Tx): Promise<Tx> {
    const bytes = tx.signBytes(network, this);
    const signature = secp256k1.sign(bytes, this.#getPrivateKey(network));
    const sigBytes = signature.toCompactRawBytes();
    if (sigBytes.length !== 64) throw new Error('Invalid signature length');
    if (!secp256k1.verify(sigBytes, bytes, this.getSignData(network).publicKey.key, { lowS: true }))
      throw new Error('Invalid signature');

    tx.setSignature(network, this, sigBytes);
    return tx;
  }

  async broadcast(tx: Tx): Promise<string> {
    const { network } = tx;
    if (!network) throw new Error('Unsigned transaction');

    const url = getRest(network);
    if (!url) throw new Error('No REST endpoint available');

    const { tx_response: response } = await Cosmos.rest(network).cosmos.tx.v1beta1.txs('POST', { mode: BroadcastMode.BROADCAST_MODE_SYNC, tx_bytes: tx.bytes() });
    if (response.code) {
      tx.reject(response.txhash, response.raw_log);
    } else {
      tx.confirm(response.txhash);
    }
    return response.txhash;
  }

  addresses(networks: NetworkConfig[] = this.#networks): string[] {
    return networks.map(network => this.address(network));
  }

  address(network: NetworkConfig): string {
    return getAddress(network.addressPrefix, this.getSignData(network).publicKey.key);
  }

  getSignData(network: NetworkConfig): SignData {
    return this.#signData.get(network)!;
  }

  #getPrivateKey(network: NetworkConfig, accountIndex = 0, addressIndex = 0) {
    if (this.#privateKey) return this.#privateKey;
    if (!this.#mnemonic) throw new Error('No private key or mnemonic set');
    const seed = bip39.mnemonicToSeedSync(this.#mnemonic);
    const key = bip32.HDKey.fromMasterSeed(seed).derive(`m/44'/${network.slip44 ?? 118}'/${accountIndex}'/0/${addressIndex}`);
    if (!key.privateKey) throw new Error('Failed to derive private key');
    return key.privateKey;
  }

  static generateMnemonic(wordlist = _wordlist, strength = 256) {
    return bip39.generateMnemonic(wordlist, strength);
  }

  static generatePrivateKey() {
    return crypto.getRandomValues(new Uint8Array(32));
  }
}
