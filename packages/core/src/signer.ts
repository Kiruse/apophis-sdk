import { Signal, signal } from '@preact/signals-core';
import type { PublicKey } from './crypto/pubkey.js';
import type { NetworkConfig } from './networks.js';
import type { TxBase } from './types.js';
import { addresses } from './address.js';
import { mw } from './middleware.js';
import { toBase64 } from './utils.js';

export type AccountData = FullAccountData | PartialAccountData;
export type ExternalAccountMap = Record<string, ExternalAccount>;

export interface FullAccountData {
  address: string;
  publicKey: PublicKey;
  accountNumber: bigint;
  sequence: bigint;
}

export interface PartialAccountData {
  address: string;
  publicKey: PublicKey;
}

/** A signer represents a wallet or another provider that can sign transactions. Typically, a signer
 * has multiple accounts for different networks, sometimes even for the same network. A Signer
 * implementation should cache the AccountData for each network and keep their sequence numbers up to date.
 */
export abstract class Signer<Tx extends TxBase = TxBase> {
  /** Array of registered signers. Can be used to list available signers in a frontend. */
  static readonly signers: Signer[] = [];

  /** Signal of whether this signer is available / has been detected. */
  readonly available = signal(false);
  /** Signal of AccountData for each connected network. */
  readonly accounts = signal<ExternalAccount[]>([]);
  /** Computed signal of networks that this signer was connected to. */
  readonly networks = signal<NetworkConfig[]>([]);

  /** Whether this signer can autoconnect once a session has been previously established. */
  abstract get canAutoReconnect(): boolean;
  /** Unique type identifier of this signer to help distinguish which you're using. Or at least it should be unique. */
  abstract get type(): string;
  /** The name of the wallet to show as tooltip or when no logo is available. */
  abstract get displayName(): string;
  /** The URL of the wallet logo. Will be shown in an <img> HTML tag. If omitted, the frontend integration should fall back to `displayName`. */
  abstract get logoURL(): string | URL | undefined;

  /** Check whether this signer is available. */
  abstract probe(): Promise<boolean>;
  /** Connect the signer for the given networks. Returns `ExternalAccount`s (independent of the network). */
  abstract connect(networks: NetworkConfig[]): Promise<ExternalAccount[]>;
  /** Disconnect the signer. Some signers may need additional cleanup. */
  async disconnect() {}
  /** Sign a transaction. Returns the same transaction, populated with the signature. */
  abstract sign(network: NetworkConfig, tx: Tx): Promise<Tx>;
  /** Broadcast a signed transaction. Returns the tx hash if successful. */
  abstract broadcast(tx: Tx): Promise<string>;

  /** Initialize the `ExternalAccount`s in the `accounts` signal for the given public keys. It
   * populates the given `accounts` object with the new accounts. `accounts` keys can be computed
   * from the public key using `Signer.getPubkeyIndex`.
   */
  protected initAccounts(accounts: ExternalAccountMap, network: NetworkConfig, pubkeys: PublicKey[]) {
    for (const pubkey of pubkeys) {
      const idx = Signer.getPubkeyIndex(pubkey);
      if (!accounts[idx]) {
        accounts[idx] = new ExternalAccount(pubkey);
      }
      accounts[idx].bind([network]);
    }
  }

  /** Activate the given account. The account must be one of the accounts in the `accounts` array signal. */
  activateAccount(account: ExternalAccount) {
    const prev = this.accounts.peek();
    const idx = prev.findIndex(acc => Signer.getPubkeyIndex(acc.publicKey) === Signer.getPubkeyIndex(account.publicKey));
    if (idx === -1) throw new Error('Unknown account');
    this.accounts.value = [
      account,
      ...prev.slice(0, idx),
      ...prev.slice(idx + 1),
    ];
  }

  /** Get the first account that is bound to the given network. If you wish to choose a different account,
   * you can prioritize it by calling `activateAccount` with that account.
   */
  getAccount(network: NetworkConfig): ExternalAccount {
    const acc = this.accounts.peek().find(acc => acc.isBound(network));
    if (!acc) throw new Error(`No account found for network ${network.name}`);
    return acc;
  }

  /** Get the sign data of the currently active account on the given network. */
  getSignData(network: NetworkConfig): AccountData {
    return this.getAccount(network).getSignData(network).peek();
  }

  /** Get the public key of the currently active account on the given network. Note that this is a
   * convenient helper unsuited for use in signals. Use the `accounts` signal property instead.
   */
  pubkey(network: NetworkConfig): PublicKey {
    return this.getAccount(network).getSignData(network).peek().publicKey;
  }

  /** Get all addresses of the signer on the given network. Most commonly, signers only have one account. */
  addresses(network: NetworkConfig): string[] {
    return this.accounts.peek().map(a => a.getSignData(network).peek().address);
  }

  /** Get the first address of the signer on the given network. Most commonly, signers only have one
   * account. *Note* that this is a convenient helper unsuited for use in signals. Use the `accounts`
   * signal property instead.
   */
  address(network: NetworkConfig): string {
    return this.getAccount(network).getSignData(network).peek().address;
  }

  /** Register a signer instance. Other components can then use this to find the signer in `Signer.signers`. */
  static register(...signers: Signer[]) {
    for (const signer of signers) {
      if (this.signers.find(s => s.type === signer.type))
        throw new Error(`Signer ${signer.type} already registered`);
      this.signers.push(signer);
    }
    return this;
  }

  /** Get a unique identifier for the given public key for comparison & indexing. */
  static getPubkeyIndex(pubkey: PublicKey) {
    const bs = typeof pubkey.bytes === 'string' ? pubkey.bytes : toBase64(pubkey.bytes);
    return `${pubkey.type}:${bs}`;
  }
}

/** ExternalAccounts are abstractions for accounts managed by private keys, and represented with public keys
 * and corresponding addresses.
 *
 * Every account must be bound to a specific network. This is because every account can be used with every
 * network that uses the same private key length, so the system has no way of knowing which networks an
 * account is actually active on.
 *
 * The `update` method can be used to update the sign data of the account on a given network. It is recommended
 * to call this method before creating a transaction. If the sign data is missing, signer integrations should
 * automatically call this method before signing or simulating a transaction.
 *
 * Alternatively, you may also specify the account number & sequence number directly. This is useful, for example,
 * when implementing a signer that is never connected to the internet.
 */
export class ExternalAccount {
  #data = new Map<NetworkConfig, Signal<AccountData>>();

  constructor(public readonly publicKey: PublicKey) {}

  /** Bind the account to the given networks. When a signer chooses an account for a transaction, it will
   * choose the first account that is bound to that specific network.
   */
  bind(networks: NetworkConfig[]) {
    for (const network of networks) {
      if (this.#data.has(network)) continue;
      this.#data.set(network, signal<AccountData>({
        address: addresses.compute(network, this.publicKey),
        publicKey: this.publicKey,
      }));
    }
  }

  /** Check whether this account has been previously bound to the given network. */
  isBound(network: NetworkConfig) {
    return this.#data.has(network);
  }

  /** Update sign data of this account on the given networks. If none specified, all previously bound
   * networks will be updated. Will only update bound networks. Any other networks will be ignored.
   */
  async update(networks?: NetworkConfig[]) {
    networks ??= Array.from(this.#data.keys());
    await Promise.all(networks.map(async network => {
      if (!this.isBound(network)) return;
      await mw('accounts', 'update').inv().notify(this, network);
    }));
  }

  /** Override the sign data. Useful for offline signers which track the account number & sequence themselves. */
  setSignData(network: NetworkConfig, accountNumber: bigint, sequence: bigint) {
    const signData = this.getSignData(network);
    signData.value = {
      ...signData.peek(),
      accountNumber,
      sequence,
    };
  }

  getSignData(network: NetworkConfig): Signal<AccountData> {
    if (!this.#data.has(network)) {
      this.#data.set(network, signal<AccountData>({
        address: addresses.compute(network, this.publicKey),
        publicKey: this.publicKey,
      }));
    }
    return this.#data.get(network)!;
  }

  static isComplete(data: AccountData): data is FullAccountData {
    return 'accountNumber' in data && 'sequence' in data;
  }
}
