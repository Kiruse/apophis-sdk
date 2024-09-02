import { type NetworkConfig, Account, type AccountData, type Loading, Cosmos, type Signer } from '@apophis-sdk/core';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Tx } from '@apophis-sdk/core/tx.js';
import { fromHex } from '@apophis-sdk/core/utils.js';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { signal } from '@preact/signals-core';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist as _wordlist } from '@scure/bip39/wordlists/english';
import { bech32 } from 'bech32';
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { LocalSigner } from './signer';

export class LocalAccount extends Account {
  readonly signal = signal<Loading<AccountData>>({ loading: true });
  #privateKey: Uint8Array | undefined;
  #mnemonic: string | undefined;

  constructor(signer: Signer = LocalSigner) {
    super(signer);
  }

  async sign(tx: Tx): Promise<Tx> {
    const { network, accountIndex, publicKey } = this.signal.value;
    if (!network || accountIndex === undefined || !publicKey) throw new Error('Account not bound');
    if (!tx.gas) throw new Error('Gas not set');

    const priv = this.#getPrivateKey(network, accountIndex);
    const bytes = SignDoc.encode(tx.signDoc(this)).finish();
    const hashed = sha256(bytes);

    const signature = await secp256k1.signAsync(hashed, priv);
    const sigBytes = signature.toCompactRawBytes();
    if (sigBytes.length !== 64) throw new Error('Invalid signature length');

    if (!secp256k1.verify(sigBytes, hashed, publicKey.key, { lowS: true })) throw new Error('Invalid signature');

    tx.setSignature(this, sigBytes);
    return tx;
  }

  async onNetworkChange(network: NetworkConfig, accountIndex: number) {
    this.signal.value = { loading: true };

    if (!network.addressPrefix) throw new Error('Network address prefix is required');

    const priv = this.#getPrivateKey(network, accountIndex);
    const pub = secp256k1.getPublicKey(priv, true);
    const address = bech32.encode(network.addressPrefix, bech32.toWords(ripemd160(sha256(pub)).slice(0, 20)));

    const { accountNumber, sequence } = await Cosmos.getAccountInfo(network, address);

    this.signal.value = {
      loading: false,
      network,
      address,
      sequence,
      publicKey: pubkey.secp256k1(pub),
      accountIndex,
      accountNumber,
    };
  }

  setMnemonic(mnemonic: string, wordlist = _wordlist) {
    mnemonic = mnemonic.trim();
    if (!bip39.validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
    this.#mnemonic = mnemonic.trim();
    this.#privateKey = undefined;
    return this;
  }

  setPrivateKey(privateKey: string | Uint8Array) {
    let key: Uint8Array;
    if (typeof privateKey === 'string') {
      // Assume the string is a hex representation
      key = fromHex(privateKey);
    } else {
      key = privateKey;
    }

    if (key.length !== 32) {
      throw new Error('Private key must be 32 bytes (64 hexadecimal characters)');
    }

    this.#privateKey = key;
    this.#mnemonic = undefined;
    return this;
  }

  #getPrivateKey(network: NetworkConfig, accountIndex: number) {
    if (this.#privateKey) {
      if (accountIndex !== 0) throw new Error('LocalAccount with private key only supports 1 account');
      return this.#privateKey;
    }

    if (!this.#mnemonic) throw new Error('No private key or mnemonic set');
    const seed = bip39.mnemonicToSeedSync(this.#mnemonic);
    const slip44 = getSlip44CoinType(network);
    const hd = bip32.HDKey.fromMasterSeed(seed).derive(`m/44'/${slip44}'/0'/0/${accountIndex}`);
    const { privateKey } = hd;
    if (!privateKey) throw new Error('Failed to derive private key');
    return privateKey;
  }

  /** Generate a new mnemonic by wordlist. Default wordlist is English. You may include other wordlists from `@scure/bip39/wordlists`. */
  static generateMnemonic(wordlist = _wordlist) {
    return bip39.generateMnemonic(wordlist);
  }
}

const getSlip44CoinType = (network: NetworkConfig) => network.slip44 ?? 118;
