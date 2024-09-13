import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bech32 } from 'bech32';
import { NetworkConfig } from './networks';
import { type MiddlewareAddresses, type MiddlewareImpl, mw } from './middleware';
import { DeepPartial } from 'cosmjs-types';
import { pubkey, PublicKey } from './crypto/pubkey';

/** Registry of address aliases. Most of the time, humans can't remember addresses, which is why
 * name registries are often established. `addresses` is an extensible singleton using middlewares
 * that allow gathering address aliases from different sources, such as ICNS, a local contact book,
 * or a shared address list.
 */
export const addresses = new class {
  /** Register an alias for the given address. */
  alias(address: string) {
    return mw('addresses', 'alias').inv().fifoMaybe(address);
  }

  /** Resolve an address for the given alias. */
  resolve(alias: string) {
    return mw('addresses', 'resolve').inv().fifoMaybe(alias);
  }

  /** Compute the address of the given public key for the given network. Different networks may use
   * different algorithms. For example, most Cosmos networks use `bech32(ripemd160(sha256(compressed)))`,
   * but Injective computes the bech32 representation of the Ethereum address, effectively using
   * `bech32(keccak256(uncompressed_pubkey[1:])[-20:])`.
   */
  compute(prefixOrNetwork: NetworkConfig | string, publicKey: PublicKey): string {
    return mw('addresses', 'compute').inv().fifo(prefixOrNetwork, publicKey);
  }
}

/** Middleware that stores address aliases in memory. */
export const MemoryAddressBook = new class implements MiddlewareImpl {
  #aliases: Record<string, string> = {};
  #resolutions: Record<string, string> = {};

  readonly addresses: DeepPartial<MiddlewareAddresses> = {
    alias: (address: string) => this.#aliases[address],
    resolve: (alias: string) => this.#resolutions[alias],
  }

  record(address: string, alias: string) {
    this.#aliases[address] = alias;
    this.#resolutions[alias] = address;
    return this;
  }

  clear(address: string) {
    const alias = this.#aliases[address];
    if (!alias) return this;
    delete this.#aliases[address];
    delete this.#resolutions[alias];
    return this;
  }
}

/** Middleware that stores address aliases in `localStorage`. */
export const LocalStorageAddressBook = new class implements MiddlewareImpl {
  readonly addresses: DeepPartial<MiddlewareAddresses> = {
    alias: (address: string) => localStorage.getItem(`@apophis-sdk:addresses:alias:${address}`) ?? undefined,
    resolve: (alias: string) => localStorage.getItem(`@apophis-sdk:addresses:resolve:${alias}`) ?? undefined,
  }

  record(address: string, alias: string) {
    localStorage.setItem(`@apophis-sdk:addresses:alias:${address}`, alias);
    localStorage.setItem(`@apophis-sdk:addresses:resolve:${alias}`, address);
    return this;
  }

  clear(address: string) {
    const alias = localStorage.getItem(`@apophis-sdk:addresses:alias:${address}`);
    if (!alias) return this;
    localStorage.removeItem(`@apophis-sdk:addresses:alias:${address}`);
    localStorage.removeItem(`@apophis-sdk:addresses:resolve:${alias}`);
    return this;
  }
}

/** Trim the given address. The resulting address will have `trimSize` characters from its start & end.
 */
export function trimAddress(address: string, trimSize: number) {
  let prefix = '';
  try {
    prefix = bech32.decode(address).prefix + '1';
    address = address.slice(prefix.length);
  } catch {}

  if (trimSize >= address.length / 2) return address;
  return `${prefix}${address.slice(0, trimSize)}…${address.slice(-trimSize)}`;
}

/** Default middleware that computes the address using the default Cosmos SDK algorithm. */
mw.use({
  addresses: {
    compute: (prefixOrNetwork: NetworkConfig | string, publicKey: PublicKey) => {
      if (!pubkey.isSecp256k1(publicKey)) throw new Error('Invalid pubkey type, expected secp256k1');
      if (publicKey.key.length !== 33) throw new Error('Invalid pubkey length, expected 33');
      const prefix = typeof prefixOrNetwork === 'string' ? prefixOrNetwork : prefixOrNetwork.addressPrefix;
      return bech32.encode(prefix, bech32.toWords(ripemd160(sha256(publicKey.key))));
    },
  },
});
