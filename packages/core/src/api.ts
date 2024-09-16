import { extendDefaultMarshaller, RecaseMarshalUnit } from '@kiruse/marshal';
import { restful } from '@kiruse/restful';
import { Event } from '@kiruse/typed-events';
import { detectCasing, recase } from '@kristiandupont/recase';
import { sha256 } from '@noble/hashes/sha256';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin.js';
import { Fee, Tx as SdkTx, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { addresses } from './address.js';
import { connections } from './connection.js';
import { PublicKey } from './crypto/pubkey.js';
import { Any } from './encoding/protobuf/any.js';
import { BytesMarshalUnit } from './marshal.js';
import { PowerSocket } from './powersocket.js';
import { TendermintQuery } from './query.js';
import * as signals from './signals.js';
import type { NetworkConfig, SignData } from './types.js';
import type { BasicRestApi, BlockEvent, BlockEventRaw, CosmosEvent, TransactionEvent, TransactionEventRaw, WS } from './types.sdk.js';
import { Tx } from './tx.js';
import { fromBase64, fromSdkPublicKey, toBase64, toHex } from './utils.js';

type Unsub = () => void;

const { marshal, unmarshal } = extendDefaultMarshaller([
  RecaseMarshalUnit(
    key => recase(detectCasing(key), 'camel')(key),
    key => recase(detectCasing(key), 'snake')(key),
  ),
  BytesMarshalUnit,
]);

/** This is the basic Cosmos REST API that is commonly used when interfacing with the blockchain.
 * Note that it does not necessarily reflect the real REST API of the target chain as it is highly
 * dependent on the chain's SDK modules and can be overridden. The API endpoints here are most
 * commonly found & used in smart contract interactions.
 */
export const Cosmos = new class {
  #apis = new Map<NetworkConfig, BasicRestApi>();
  #sockets = new Map<NetworkConfig, CosmosWebSocket>();
  #signData = new Map<NetworkConfig, SignData[]>();
  #signDataWatchers = new Map<NetworkConfig, Unsub>();

  /** Get a bound REST API. When undefined, gets the REST API for the current `defaultNetwork` signal
   * value. If that, too, is undefined, throws an error. Note that this associates the concrete
   * `NetworkConfig` instance with the REST API instance, so take care to pass around the correct
   * object instance.
   */
  rest(network?: NetworkConfig) {
    network ??= signals.network.value;
    if (!network) throw new Error('No network specified and no active network set');
    if (!this.#apis.get(network)) {
      this.#apis.set(network, restful.default<BasicRestApi>({
        baseUrl() {
          const url = connections.rest(network);
          if (!url) throw new Error(`No REST API URL set for the network: ${network.name}`);
          return url;
        },
        marshal,
        unmarshal,
      }));
    }
    return this.#apis.get(network)!;
  }

  ws(network?: NetworkConfig) {
    network ??= signals.network.value;
    if (!network) throw new Error('No network specified and no active network set');
    if (!this.#sockets.get(network)) {
      this.#sockets.set(network, new CosmosWebSocket(network).connect());
    }
    return this.#sockets.get(network)!;
  }

  async getAccountInfo(network: NetworkConfig, address: string) {
    if (!network || !address) throw new Error('Account not bound to a network');
    // TODO: this should handle 429s & retry automatically
    const { info } = await this.rest(network).cosmos.auth.v1beta1.account_info[address]('GET');
    return {
      accountNumber: info.account_number,
      address: info.address,
      publicKey: info.pub_key,
      sequence: info.sequence,
    };
  }

  async watchSignData(network: NetworkConfig, publicKey: PublicKey) {
    if (!this.#signData.has(network)) this.#signData.set(network, []);
    const signData = this.#signData.get(network)!;
    const address = addresses.compute(network, publicKey);
    const existing = signData.find(s => s.address === address);
    if (existing) return existing;

    const { sequence, accountNumber } = await this.getAccountInfo(network, address).catch(() => ({ sequence: 0n, accountNumber: 0n }));
    const info: SignData = {
      address,
      publicKey,
      sequence,
      accountNumber,
    };
    signData.push(info);

    this.#watchNetwork(network);
    return info;
  }

  unwatchSignData(network: NetworkConfig, address: string) {
    const signData = this.#signData.get(network)!;
    const index = signData.findIndex(s => s.address === address);
    if (index === -1) return;
    signData.splice(index, 1);
    if (signData.length === 0) {
      this.#signDataWatchers.get(network)?.();
      this.#signDataWatchers.delete(network);
      this.#signData.delete(network);
    }
  }

  #watchNetwork(network: NetworkConfig) {
    // watch for blocks involving our addresses as signers
    const unsub1 = this.ws(network).onBlock(async block => {
      const addrs = this.#signData.get(network)!.map(s => s.address);
      const txs = block.txs.map(tx => Cosmos.tryDecodeTx(tx)).filter(tx => typeof tx !== 'string');

      for (const address of addrs) {
        const signerInfos = txs.flatMap(tx => tx.authInfo?.signerInfos).filter(info => !!info);
        for (const signerInfo of signerInfos) {
          const pubkey = fromSdkPublicKey(signerInfo.publicKey!);
          if (addresses.compute(network, pubkey) === address) {
            const info = this.#signData.get(network)?.find(s => s.address === address);
            if (info && info.sequence < signerInfo.sequence + 1n) info.sequence = signerInfo.sequence + 1n;
          }
        }
      }
    });
    // upon reconnecting, update the sequence number for all accounts
    const unsub2 = this.ws(network).socket.onReconnect(async () => {
      const infos = this.#signData.get(network)!;
      for (const info of infos) {
        const { sequence, accountNumber } = await this.getAccountInfo(network, info.address).catch(() => ({ sequence: 0n, accountNumber: 0n }));
        if (info && info.sequence < sequence) info.sequence = sequence;
        if (info && info.accountNumber === 0n) info.accountNumber = accountNumber;
      }
    });
    this.#signDataWatchers.set(network, () => {
      unsub1();
      unsub2();
    });
  }

  cosmwasm(network?: NetworkConfig) {
    return this.rest(network).cosmwasm.wasm.v1;
  }

  /** Create a new transaction with the given messages. */
  tx = (messages: Any[], opts?: Omit<TxBody, 'messages'> & { gas?: Fee }) => new Tx(messages, opts);
  coin = (amount: bigint | number, denom: string): Coin => Coin.fromPartial({ amount: amount.toString(), denom });

  txs(network?: NetworkConfig) {
    return this.rest(network).cosmos.tx.v1beta1.txs;
  }

  /** Helper function to decode the bytes of a Cosmos SDK transaction.
   *
   * **Note** that the resulting type is not the same as this `Tx` class of this library, but instead
   * from `cosmjs-types/cosmos/tx/v1beta1/tx` which is directly built from the Cosmos SDK protobuf
   * definitions.
   */
  decodeTx(tx: SdkTx | string | Uint8Array) {
    if (typeof tx === 'string') tx = fromBase64(tx);
    if (tx instanceof Uint8Array) return SdkTx.decode(tx);
    return tx;
  }

  /** Wrapper around `decodeTx` that attempts to decode the tx. If it fails, returns the original tx bytes. */
  tryDecodeTx(tx: SdkTx | string | Uint8Array) {
    try {
      return this.decodeTx(tx);
    } catch {
      return typeof tx === 'string' ? tx : tx instanceof Uint8Array ? toBase64(tx) : tx;
    }
  }

  /** Helper function to compute the transaction hash of a Cosmos SDK transaction. This hash can then
   * be used to query the transaction on the blockchain.
   */
  getTxHash(tx: SdkTx | string) {
    let bytes: Uint8Array;
    if (typeof tx === 'string') {
      bytes = fromBase64(tx);
    } else {
      bytes = SdkTx.encode(tx).finish();
    }

    const buffer = sha256(bytes);
    return toHex(new Uint8Array(buffer));
  }

  /** Search a list of `CosmosEvent`s for a particular event/attribute. The result is a list of all
   * matching values in the order of their occurrence.
   */
  getEventValues(events: CosmosEvent[], event: string, attribute: string) {
    return events
      .filter(e => e.type === event)
      .flatMap(e => e.attributes.filter(attr => attr.key === attribute).map(attr => attr.value));
  }
}

export class CosmosWebSocket {
  socket: PowerSocket<string>;
  #subs: Record<number, TxSubscriptionMetadata> = {};
  #nextSubId = 2; // 1 is reserved for block subscription
  #onBlock = Event<BlockEvent>();
  #heartbeat: ReturnType<typeof setInterval> | undefined;

  constructor(public readonly network: NetworkConfig) {
    this.socket = new PowerSocket<string>(() => this.endpoint);
  }

  connect() {
    this.socket.connect();
    this.socket.onConnect(() => {
      this.socket.send({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: ['tm.event = \'NewBlock\''],
        id: 1,
      });
      this.socket.onMessage(async ({ args: msg }) => {
        try {
          const result = unmarshal(JSON.parse(msg)) as RPCResult;
          if (result.error) {
            console.warn('RPC error:', result);
            return;
          }

          // ignore ACK messages (for now)
          if (!result.result || !Object.entries(result.result).length) return;
          if (result.id === 1) {
            const { data: { value: { block, result_finalize_block } } } = (result.result as BlockEventRaw);
            this.#onBlock.emit({
              header: block.header,
              lastCommit: block.last_commit,
              events: result_finalize_block?.events ?? [],
              txs: block.data?.txs.map(Cosmos.tryDecodeTx) ?? [],
              evidence: block.evidence.evidence,
              txResults: result_finalize_block?.tx_results ?? [],
            });
          } else if (result.id in this.#subs) {
            // TODO: should handle multiple subscriptions for the same tx + query
            const { data: { value: { tx_result: tx } } } = result.result as TransactionEventRaw;
            if ('code' in tx.result) {
              this.#subs[result.id]?.callback({
                height: tx.height,
                error: tx.result,
                txBytes: tx.tx,
                index: tx.index,
              });
            } else {
              this.#subs[result.id]?.callback({
                height: tx.height,
                txhash: await Cosmos.getTxHash(tx.tx),
                index: tx.index,
                result: tx.result,
                tx: Cosmos.decodeTx(tx.tx),
              });
            }
          }
        } catch (e) {
          console.error(
            Object.assign(Error('Invalid JSON message received'), {
              message: msg,
              context: this,
              cause: e,
            })
          );
        }
      });
      this.#heartbeat = setInterval(this.#sendHeartbeat, 30000);
    });

    const clearHeartbeat = () => {
      clearInterval(this.#heartbeat!);
      this.#heartbeat = undefined;
    }
    this.socket.onDisconnect(clearHeartbeat);
    this.socket.onClose(clearHeartbeat);
    return this;
  }

  reconnect() {
    this.socket.reconnect();
    return this;
  }

  close() {
    this.socket.close();
    return this;
  }

  onBlock(callback: (block: BlockEvent) => void) {
    return this.#onBlock(({ args: block }) => callback(block));
  }

  /** Listen for new transactions, optionally filtered by a query.
   *
   * **Beware** that many public nodes do not expose a WebSocket endpoint at all, and that these
   * subscriptions may even be limited. If you need to monitor various different types of
   * transactions, you should consider using a single subscription and filtering the transactions
   * on the client-side.
   */
  onTx(query: TendermintQuery | null, callback: (tx: TransactionEvent) => void): Unsub {
    query ??= new TendermintQuery();
    query.exact('tm.event', 'Tx');

    const id = this.#nextSubId++;
    this.#subs[id] = { type: 'tx', id, query: query ?? undefined, callback };
    const subscribe = () => {
      this.socket.send({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: [query.toString()],
        id,
      });
    };
    this.socket.onConnect(subscribe);
    if (this.socket.connected) subscribe();
    return () => {
      delete this.#subs[id];
      this.socket.send({
        jsonrpc: '2.0',
        method: 'unsubscribe',
        id,
      });
    }
  }

  /** Method corresponding to the `tx_search` JSONRPC method. It returns an async-iterable cursor for convenience. */
  searchTxs(query: TendermintQuery, { pageSize = 100, page: pageOffset = 1, order = 'asc', prove = true }: WS.SearchTxsParams = {}) {
    const q = query.toString();
    const currentIndex = () => BigInt(page) * BigInt(pageSize) + BigInt(cursor);
    const fetch = () => this.send<WS.SearchTxsResponse>('tx_search', q, prove, page.toString(), pageSize.toString(), order);
    const fetchNext = () => currentIndex() < total && (page++, promise = fetch(), true);

    let page = pageOffset, cursor = 0, total: bigint, promise = fetch();

    return new class {
      async *[Symbol.asyncIterator]() {
        page = pageOffset;
        do {
          let response = await promise;
          total = BigInt(response.total_count);
          cursor = 0;
          while (cursor < response.txs.length) {
            yield response.txs[cursor++];
          }
        } while (fetchNext());
      }

      async all() {
        const result: WS.SearchTxsResponse['txs'] = [];
        for await (const tx of this) result.push(tx);
        return result;
      }

      get total() { return total }
      get page() { return page }
      get index() { return currentIndex() }
    }
  }

  /** Send is a low level method to directly invoke an RPC method on the remote endpoint. It wraps
   * around the underlying jsonrpc protocol and returns a promise that resolves with the result of
   * the request after unmarshalling it.
   */
  send<T = unknown>(method: string, ...params: any[]) {
    return new Promise<T>((resolve, reject) => {
      const id = this.#nextSubId++;
      this.socket.send({
        jsonrpc: '2.0',
        method,
        params,
        id,
      });

      this.socket.onMessage.oncePred(({ args: msg }) => {
        const result = unmarshal(JSON.parse(msg)) as RPCResult<T>;
        if (result.id === id) {
          if (result.result) {
            resolve(result.result);
          } else {
            reject(result.error);
          }
        }
      }, ({ args }) => {
        try {
          return JSON.parse(args).id === id;
        } catch {
          return false;
        }
      });
    });
  }

  #sendHeartbeat = () => {
    if (!this.socket.connected) return;
    const id = this.#nextSubId++;
    const timeout = setTimeout(() => {
      if (!this.socket.connected) return;
      console.warn('Heartbeat timed out, reconnecting...');
      this.reconnect();
    }, 30000);
    this.socket.send({
      jsonrpc: '2.0',
      method: 'health',
      id,
    });
    this.socket.onMessage.oncePred(({ args: msg }) => {
      clearTimeout(timeout);
    }, ({ args }) => JSON.parse(args).id === id);
  }

  get endpoint() {
    const ep = connections.ws(this.network);
    if (!ep) throw new Error(`No WebSocket endpoint set for the network: ${this.network.name}`);
    return ep;
  }
}

interface TxSubscriptionMetadata {
  type: 'block' | 'tx';
  id: number;
  query?: TendermintQuery;
  callback: (data: TransactionEvent) => void;
}

type RPCResult<T = unknown> = RPCSuccess<T> | RPCError;
interface RPCSuccess<T> {
  jsonrpc: '2.0';
  id: number;
  result: T;
  error?: undefined;
}
interface RPCError {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: number;
    message: string;
    data: string;
  };
  result?: undefined;
}
