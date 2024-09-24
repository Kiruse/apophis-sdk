import { computed, signal } from '@preact/signals-core';
import type { PublicKey } from './crypto/pubkey';
import type { NetworkConfig } from './networks';
import * as signals from './signals';
import { Tx } from './tx';
import { Cosmos } from './api';

export interface SignData {
  address: string;
  publicKey: PublicKey;
  /** The sequence number of this account to prevent replay attacks. If 0, the account has never
   * created a transaction before.
   */
  sequence: bigint;
  /** The account number of this account as registered on the chain. If 0, the account has never
   * been seen on-chain before and must first be funded. Upon funding, the account receives a number
   * and can henceforth be used as a signer.
   */
  accountNumber: bigint;
}

export type InitSignData = Pick<SignData, 'address' | 'publicKey'> & { network: NetworkConfig };

/** A signer represents a wallet or another provider that can sign transactions. Typically, a signer
 * has multiple accounts for different networks, sometimes even for the same network. A Signer
 * implementation should cache the SignData for each network and keep their sequence numbers up to date.
 */
export abstract class Signer {
  /** Signal of whether this signer is available / has been detected. */
  readonly available = signal(false);
  /** Signal of SignData for each connected network. */
  readonly signDatas = signal<Map<NetworkConfig, SignData[]> | undefined>(undefined);
  /** Computed signal of networks that this signer was connected to. */
  readonly networks = computed(() => Array.from(this.signDatas.value?.keys() ?? []));

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
  /** Connect the signer for the given networks. */
  abstract connect(networks: NetworkConfig[]): Promise<void>;
  /** Sign a transaction. */
  abstract sign(network: NetworkConfig, tx: Tx): Promise<Tx>;
  /** Broadcast a signed transaction. Returns the tx hash if successful. */
  abstract broadcast(tx: Tx): Promise<string>;

  /** Signer implementations should call this method at the end of their `connect` implementation.
   * This method initializes the SignData for each network and registers the signer with the Cosmos
   * API for monitoring account changes. It is safe to call this method multiple times, although you
   * should avoid it.
   */
  protected async _initSignData(networks: NetworkConfig[]) {
    const result = new Map<NetworkConfig, SignData[]>();
    await Promise.all(networks.map(async network => {
      const signDatas: SignData[] = result.get(network) ?? [];
      const accounts = await this.getAccounts(network);
      for (const { address, publicKey } of accounts) {
        const { accountNumber, sequence } = await Cosmos.getAccountInfo(network, address).catch(() => ({ accountNumber: 0n, sequence: 0n }));
        signDatas.push({ address, publicKey, accountNumber, sequence });
      }
      result.set(network, signDatas);
    }));
    this.signDatas.value = result;
  }

  protected abstract getAccounts(network: NetworkConfig): Promise<{ address: string; publicKey: PublicKey }[]>;

  /** Get the addresses of this signer for the given networks. If no networks are provided, returns the addresses of all connected networks. */
  addresses(networks?: NetworkConfig[]): string[] {
    if (!this.signDatas.value) throw new Error('Not connected');
    return Array.from(this.signDatas.value!.values()).flatMap(data => data.map(d => d.address));
  }

  /** Get the address for the given network. If no network is provided, returns the address of the currently bound network. */
  address(network?: NetworkConfig): string {
    if (!network && !signals.network.value) throw new Error('No (default) network provided');
    network ??= signals.network.value!;
    const addr = this.getSignData(network)[0]?.address;
    if (!addr) throw new Error(`No address for ${network.name}`);
    return addr;
  }

  /** Get SignData for a specific network. Throws if no SignData is available. */
  getSignData(network: NetworkConfig): SignData[] {
    return this.signDatas.value?.get(network) ?? [];
  }
}
