import { extendDefaultMarshaller, RecaseMarshalUnit } from '@kiruse/marshal';
import { restful } from '@kiruse/restful';
import { Event } from '@kiruse/typed-events';
import { recase } from '@kristiandupont/recase';
import { sha256 } from '@noble/hashes/sha256';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin.js';
import { Fee, Tx as SdkTx, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { addresses } from './address.js';
import { connections } from './connection.js';
import { Any } from './encoding/protobuf/any.js';
import { BytesMarshalUnit } from './marshal.js';
import { PowerSocket } from './powersocket.js';
import { TendermintQuery } from './query.js';
import * as signals from './signals.js';
import type { SignData, Signer } from './signer.js';
import type { NetworkConfig } from './types.js';
import { BroadcastMode, TransactionResult, type BasicRestApi, type Block, type BlockEvent, type BlockEventRaw, type CosmosEvent, type TransactionEvent, type TransactionEventRaw, type TransactionResponse, type WS } from './types.sdk.js';
import { Tx } from './tx.js';
import { fromBase64, fromSdkPublicKey, getRandomItem, toBase64, toHex } from './utils.js';
import { BlockID } from 'cosmjs-types/tendermint/types/types.js';
import { mw } from './middleware.js';

type Unsub = () => void;

const { marshal, unmarshal } = extendDefaultMarshaller([
  RecaseMarshalUnit(
    key => recase('mixed', 'camel')(key),
    key => recase('mixed', 'snake')(key),
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
  #signers: WeakRef<Signer>[] = [];
  #networkWatchers = new Map<NetworkConfig, Unsub>();

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
          const url = getRandomItem(connections.rest(network));
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

  /** Watch a signer for network updates. This keeps the signer's sequence numbers in sync and
   * updates the account number if the account hadn't been seen yet.
   */
  watchSigner(signer: Signer) {
    const found = this.#signers.find(ref => ref.deref() === signer);
    if (!found) this.#signers.push(new WeakRef(signer));
    this.#updateNetworkWatchers();
  }

  #updateNetworkWatchers() {
    const prevNetworks = new Set(this.#networkWatchers.keys());
    const networks = new Set<NetworkConfig>();
    for (const ref of this.#signers) {
      const signer = ref.deref();
      if (!signer) continue;
      signer.networks.value.forEach(network => {
        networks.add(network);
      });
    }

    const droppedNetworks = setDiff(prevNetworks, networks);
    for (const network of droppedNetworks) {
      this.#networkWatchers.get(network)?.();
      this.#networkWatchers.delete(network);
    }

    const addedNetworks = setDiff(networks, prevNetworks);
    for (const network of addedNetworks) {
      this.#watchNetwork(network);
    }

    this.#purgeSigners();
  }

  #watchNetwork(network: NetworkConfig) {
    // we do things by address here primarily, so it's easiest to build a map of all addresses to signDatas
    const buildSignDataMap = () => {
      const result: Record<string, SignData[]> = {};
      const signers = this.#signers
        .map(s => s.deref())
        .filter(s => !!s)
        .filter(s => s.networks.value.includes(network));
      for (const signer of signers) {
        const signDatas = signer.getSignData(network);
        for (const signData of signDatas) {
          result[signData.address] ??= [];
          result[signData.address].push(signData);
        }
      }
      return result;
    }

    // watch for blocks involving our addresses as signers
    const unsub1 = this.ws(network).onBlock(async block => {
      this.#purgeSigners();
      const txs = block.txs.map(tx => Cosmos.tryDecodeTx(tx)).filter(tx => typeof tx !== 'string');
      const signerInfos = txs.flatMap(tx => tx.authInfo?.signerInfos).filter(info => !!info);
      const signDataMap = buildSignDataMap();

      for (const signerInfo of signerInfos) {
        const txPubkey = fromSdkPublicKey(signerInfo.publicKey!);
        const txAddress = addresses.compute(network, txPubkey);
        if (signDataMap[txAddress]) {
          signDataMap[txAddress].forEach(signData => {
            if (signData.sequence < signerInfo.sequence + 1n)
              signData.sequence = signerInfo.sequence + 1n;
            // if account number is 0, it has just been created. fetch its number
            if (signData.accountNumber === 0n) {
              Cosmos.getAccountInfo(network, signData.address).then(({ accountNumber }) => {
                signData.accountNumber = accountNumber;
              }).catch(() => { console.warn('Failed to fetch account number for ', signData.address) });
            }
          });
        }
      }
    });

    // upon reconnecting, update the sequence number for all accounts
    const unsub2 = this.ws(network).socket.onReconnect(async () => {
      this.#purgeSigners();
      const signDataMap = buildSignDataMap();
      for (const [address, signDatas] of Object.entries(signDataMap)) {
        const { sequence, accountNumber } = await this.getAccountInfo(network, address).catch(() => ({ sequence: 0n, accountNumber: 0n }));
        for (const signData of signDatas) {
          if (signData.sequence < sequence) signData.sequence = sequence;
          if (signData.accountNumber === 0n) signData.accountNumber = accountNumber;
        }
      }
    });

    this.#networkWatchers.set(network, () => {
      unsub1();
      unsub2();
    });
  }

  #purgeSigners() {
    this.#signers = this.#signers.filter(ref => ref.deref() !== undefined);
  }

  /** Create a new transaction with the given messages. */
  tx = (messages: Any[], opts?: Omit<TxBody, 'messages'> & { gas?: Fee }) => new Tx(messages, opts);
  coin = (amount: bigint | number, denom: string): Coin => Coin.fromPartial({ amount: amount.toString(), denom });

  /** Broadcast a transaction to the network. If `async` is true, will not wait for inclusion in a
   * block and return immediately, but it also will not throw upon rejection of the transaction.
   *
   * If a WebSocket connection has previously been opened (not yet necessarily established successfully)
   * it will be used for the broadcast. Otherwise, the REST API will be used. The WebSocket method
   * is generally preferable over the REST method as a connection to the RPC is already opened,
   * resulting in lower latency and truthfulness of the blockchain state (when responding to block or
   * transaction events).
   *
   * If you wish to force either a WebSocket or REST broadcast, you may do so with
   * `Cosmos.ws(network).broadcast(...)` or `Cosmos.rest(network).cosmos.tx.v1beta1.txs('POST', ...)`,
   * respectively.
   *
   * @returns the hash of the transaction, computed locally. The existence of the hash is no confirmation of the tx.
   */
  async broadcast(network: NetworkConfig, tx: Tx, async = false): Promise<string> {
    // try to broadcast via ws if any has been opened yet. timeout 5s to avoid user waiting too long
    // ws is generally preferable due to lower latency as the connection is already open
    if (this.#sockets.get(network)?.connected) {
      const ws = this.ws(network);
      await ws.ready(5000);
      return ws.broadcast(tx, async);
    } else {
      const { tx_response: { txhash } } = await this.rest(network).cosmos.tx.v1beta1.txs('POST', {
        tx_bytes: tx.bytes(),
        mode: async ? BroadcastMode.BROADCAST_MODE_ASYNC : BroadcastMode.BROADCAST_MODE_SYNC,
      });
      return txhash;
    }
  }

  /** Attempts to find the last block before the given timestamp.
   *
   * @param network
   * @param timestamp
   * @param startHeight where to begin searching from. Defaults to current height.
   * @param blockSpeed is the average number of seconds between blocks. Although it is network-dependent,
   * it defaults to 3 seconds for many chains. The exact speed doesn't matter as it is just a
   * heuristic to estimate number of blocks between two timestamps.
   * @param connectionTimeout is used when first establishing a connection to the full node and defaults to 10s.
   */
  async findBlockAt(network: NetworkConfig, timestamp: Date, startHeight?: bigint, blockSpeed = 3, connectionTimeout = 10000) {
    if (this.#sockets.get(network)?.connected) {
      const ws = this.ws(network);
      await ws.ready(connectionTimeout);
      if (timestamp >= new Date()) return (await ws.getBlock()).block;

      let { block: lastBlock } = await ws.getBlock(startHeight);
      let { block } = await ws.getBlock(guessNextHeight(lastBlock, timestamp, blockSpeed));
      while (!foundTargetBlock(block, lastBlock, timestamp)) {
        // blockSpeed has an anti-proportional effect on the step size, so we increase it with every
        // iteration to prevent overshooting
        blockSpeed *= 1.1;
        lastBlock = block;
        ({ block } = await ws.getBlock(guessNextHeight(block, timestamp, blockSpeed)));
      }
      return block.header.height < lastBlock.header.height ? block : lastBlock;
    } else {
      throw new Error('findBlockBefore by REST is not yet implemented');
    }
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
  #heartbeat: ReturnType<typeof setTimeout> | undefined;

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
      this.#heartbeat = setTimeout(this.#sendHeartbeat, 35000);
    });
    this.socket.onDisconnect(() => {
      clearTimeout(this.#heartbeat!);
      this.#heartbeat = undefined;
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

  /** Broadcast a transaction to the network. If `async` is true, will not wait for inclusion in a
   * block and return immediately, but it also will not throw upon rejection of the transaction.
   *
   * @returns the hash of the transaction, computed locally. The existence of the hash is no confirmation of the tx.
   */
  async broadcast(tx: Tx, async = false): Promise<string> {
    const method = async ? 'broadcast_tx_async' : 'broadcast_tx_sync';
    const result = await this.send<TransactionResult>(method, [tx.bytes()]);
    if (result.code)
      throw new Error(`Failed to broadcast transaction: ${result.code} (${result.codespace}): ${result.log}`);
    return tx.hash;
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

  /** Expect the given TX to appear on-chain within the given timeframe. */
  expectTx(tx: Tx, timeout = 30000) {
    return new Promise<Required<TransactionEvent>['result']>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        unsub();
        reject(new Error(`Transaction ${tx.hash} not found on-chain within ${timeout}ms`));
      }, timeout);

      const unsub = this.onTx(
        new TendermintQuery().exact('tx.hash', tx.hash.toUpperCase()),
        (ev) => {
          unsub();
          clearTimeout(timeoutHandle);
          if (ev.error?.code) {
            reject(ev.error);
          } else {
            if (!ev.result) {
              reject(new Error(`Transaction ${tx.hash} found but was returned without results`));
            } else {
              resolve(ev.result);
            }
          }
        }
      );
    });
  }

  /** Get a block by height. If height is not specified, the latest block is returned. */
  getBlock(height?: bigint) {
    return this.send<{ block: Block, block_id: BlockID }>('block', { height });
  }

  /** Get a transaction by hash. Optionally, you may request a merkle tree proof of the transaction's inclusion in the block (default: true). */
  getTx(hash: string, prove = true) {
    const id = this.#nextSubId++;
    this.socket.send({
      jsonrpc: '2.0',
      method: 'get_tx',
      params: { hash, prove },
      id,
    });
    return new Promise<TransactionResponse>((resolve, reject) => {
      this.socket.onMessage.oncePred(({ args: msg }) => {
        const result = unmarshal(JSON.parse(msg)) as RPCResult<TransactionResponse>;
        if (result.id === id) {
          if (result.result) {
            resolve(result.result);
          } else {
            reject(result.error);
          }
        }
      }, ({ args }) => JSON.parse(args).id === id);
    });
  }

  /** Method corresponding to the `tx_search` JSONRPC method. It returns an async-iterable cursor for convenience. */
  searchTxs(query: TendermintQuery, { pageSize = 100, page: pageOffset = 1, order = 'asc', prove = true }: WS.SearchTxsParams = {}) {
    const q = query.toString();
    const pageIndex = (page: number) => BigInt(page - 1) * BigInt(pageSize);
    const currentIndex = () => pageIndex(page) + BigInt(cursor);
    const fetch = async () => {
      const response = await this.send<WS.SearchTxsResponse>('tx_search', [q, prove, page.toString(), pageSize.toString(), order]);
      total = BigInt(response.total_count);
      return response.txs;
    };
    const fetchNext = () => pageIndex(page + 1) < total && (page++, promise = fetch(), true);

    let page = pageOffset, cursor = 0, total: bigint, promise = fetch();

    return new class {
      ready = () => promise.then(()=>{});

      async *[Symbol.asyncIterator]() {
        page = pageOffset;
        do {
          let response = await promise;
          cursor = 0;
          while (cursor < response.length) {
            yield response[cursor++];
          }
        } while (fetchNext());
      }

      async all() {
        const result: WS.SearchTxsResponse['txs'] = [];
        for await (const tx of this) result.push(tx);
        return result;
      }

      /** Generator that yields all pages of transactions. */
      async *pages() {
        if (typeof total === 'undefined') await this.ready();
        if (currentIndex() >= total) return;
        do {
          yield await promise;
        } while (fetchNext());
      }

      async currentPage() {
        return await promise;
      }

      get total() { return total }
      get page() { return page }
      set page(value) { page = value }
      get index() { return currentIndex() }
    }
  }

  /** Send is a low level method to directly invoke an RPC method on the remote endpoint. It wraps
   * around the underlying jsonrpc protocol and returns a promise that resolves with the result of
   * the request after unmarshalling it.
   */
  send<T = unknown>(method: string, params?: any) {
    params = params && marshal(params);
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
    this.#heartbeat = undefined;
    if (!this.connected) return;
    const timeout = setTimeout(() => {
      if (!this.connected) return;
      console.warn('Heartbeat timed out, reconnecting...');
      this.reconnect();
    }, 30000);
    this.send('health').then(() => {
      clearTimeout(timeout);
      this.#heartbeat = setTimeout(this.#sendHeartbeat, 35000);
    }).catch(err => {
      if (!this.connected) return;
      console.error('Heartbeat error:', err);
      this.reconnect();
    });
  }

  ready(timeout?: number) {
    return this.socket.ready(timeout);
  }

  get connected() { return this.socket.connected }

  get endpoint() {
    const ep = getRandomItem(connections.ws(this.network));
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

function setDiff<T>(setA: Set<T>, setB: Set<T>) {
  //@ts-ignore
  if (typeof Set.prototype.difference === 'function') {
    //@ts-ignore
    return setA.difference(setB);
  }
  return new Set(Array.from(setA).filter(x => !setB.has(x)));
}

/** Guess the next block height based on the given block and the target timestamp. This method is
 * intended to be used to search for a specific block at the given `timestamp` with a divide-and-conquer
 * approach.
 *
 * @param lastBlock used for the reference time & height.
 * @param timestamp is the target timestamp we'd like to find the closest block for.
 * @param blockSpeed is the average number of seconds between blocks. The exact speed doesn't matter as it is just a heuristic.
 * @returns the height of the next block.
 */
function guessNextHeight(lastBlock: Block, timestamp: Date, blockSpeed: number): bigint {
  const deltaTime = timestamp.getTime() - lastBlock.header.time.getTime();
  const blocksToAdd = Math.floor(deltaTime / (blockSpeed * 1000));
  return lastBlock.header.height + BigInt(blocksToAdd);
}

function foundTargetBlock(blockA: Block, blockB: Block, timestamp: Date) {
  return (blockA.header.time < timestamp && timestamp < blockB.header.time) &&
    ((blockA.header.height + 1n) === blockB.header.height);
}
