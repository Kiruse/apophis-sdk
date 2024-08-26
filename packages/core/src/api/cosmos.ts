import { Event } from '@kiruse/typed-events';
import { extendDefaultMarshaller, RecaseMarshalUnit } from '@kiruse/marshal';
import { restful } from '@kiruse/restful';
import { detectCasing, recase } from '@kristiandupont/recase';
import { Tx as SdkTx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Account } from '../account.js';
import { getRest, getWebSocketEndpoint } from '../connection.js';
import * as Protobuf from '../encoding/protobuf.js';
import * as signals from '../signals.js';
import { NetworkConfig } from '../types.js';
import type { BasicRestApi, CosmosBlockEvent, CosmosBlockEventRaw, CosmosTransactionEvent, CosmosTransactionEventRaw } from '../types.cosmos.js';
import { PowerSocket } from '../powersocket.js';
import { fromBase64, toBase64, toHex } from '../utils.js';

type Unsub = () => void;

const { marshal, unmarshal } = extendDefaultMarshaller([
  RecaseMarshalUnit(
    key => recase(detectCasing(key), 'camel')(key),
    key => recase(detectCasing(key), 'snake')(key),
  ),
  Protobuf.AnyMarshalUnit,
]);

/** This is the basic Cosmos REST API that is commonly used when interfacing with the blockchain.
 * Note that it does not necessarily reflect the real REST API of the target chain as it is highly
 * dependent on the chain's SDK modules and can be overridden. The API endpoints here are most
 * commonly found & used in smart contract interactions.
 */
export const Cosmos = new class {
  #apis = new Map<NetworkConfig, BasicRestApi>();
  #sockets = new Map<NetworkConfig, CosmosWebSocket>();

  /** Get a bound REST API. When undefined, gets the REST API for the current `defaultNetwork` signal
   * value. If that, too, is undefined, throws an error. Note that this associates the concrete
   * `NetworkConfig` instance with the REST API instance, so take care to pass around the correct
   * object instance.
   */
  rest(network?: NetworkConfig) {
    network ??= signals.defaultNetwork.value;
    if (!network) throw new Error('No network specified and no default network set');
    if (!this.#apis.get(network)) {
      this.#apis.set(network, restful.default<BasicRestApi>({
        baseUrl() {
          const url = getRest(network);
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
    network ??= signals.defaultNetwork.value;
    if (!network) throw new Error('No network specified and no default network set');
    if (!this.#sockets.get(network)) {
      this.#sockets.set(network, new CosmosWebSocket(network).connect());
    }
    return this.#sockets.get(network)!;
  }

  async getAccountInfo(account: Account<any>) {
    const { network, address } = account;
    if (!network || !address) throw new Error('Account not bound to a network');
    const response = await this.rest(account.network).cosmos.auth.v1beta1.account_info[address]('GET');
    return {
      accountNumber: response.account_number,
      address: response.address,
      publicKey: response.pub_key,
      sequence: response.sequence,
    };
  }

  get cosmwasm() {
    return this.rest().cosmwasm.wasm.v1;
  }

  get tx() {
    return this.rest().cosmos.tx.v1beta1;
  }
}

export class CosmosWebSocket {
  socket: PowerSocket<string>;
  #subs: Record<number, TxSubscriptionMetadata> = {};
  #nextSubId = 2; // 1 is reserved for block subscription
  #onBlock = Event<CosmosBlockEvent>();

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
          // ignore ACK messages (for now)
          if (!result.result || !Object.entries(result.result).length) return;
          if (result.id === 1) {
            const { data: { value: { block, result_finalize_block } } } = (result.result as CosmosBlockEventRaw);
            this.#onBlock.emit({
              header: block.header,
              lastCommit: block.last_commit,
              events: result_finalize_block?.events ?? [],
              txs: block.data?.txs.map(tryDecodeCosmosTx) ?? [],
              evidence: block.evidence.evidence,
              txResults: result_finalize_block?.tx_results ?? [],
            });
          } else {
            // TODO: should handle multiple subscriptions for the same tx + query
            const { data: { value: { tx_result: tx } } } = result.result as CosmosTransactionEventRaw;
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
                txhash: await getCosmosTxHash(tx.tx),
                index: tx.index,
                result: tx.result,
                tx: decodeCosmosTx(tx.tx),
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
    });
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

  onBlock(callback: (block: CosmosBlockEvent) => void) {
    return this.#onBlock(({ args: block }) => callback(block));
  }

  /** Listen for new transactions, optionally filtered by a query.
   *
   * **Beware** that many public nodes do not expose a WebSocket endpoint at all, and that these
   * subscriptions may even be limited. If you need to monitor various different types of
   * transactions, you should consider using a single subscription and filtering the transactions
   * on the client-side.
   */
  onTx(query: TendermintQuery | null, callback: (tx: CosmosTransactionEvent) => void): Unsub {
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

  /** Send is a low level method to directly invoke an RPC method on the remote endpoint. It wraps
   * around the underlying jsonrpc protocol and returns a promise that resolves with the result of
   * the request after unmarshalling it.
   */
  send<T = unknown>(method: string, ...params: any[]) {
    return new Promise<T>((resolve) => {
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
          resolve(result.result);
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

  get endpoint() {
    const ep = getWebSocketEndpoint(this.network);
    if (!ep) throw new Error(`No WebSocket endpoint set for the network: ${this.network.name}`);
    return ep;
  }
}

interface TxSubscriptionMetadata {
  type: 'block' | 'tx';
  id: number;
  query?: TendermintQuery;
  callback: (data: CosmosTransactionEvent) => void;
}

interface RPCResult<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result: T;
}

const escape = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export class TendermintQuery {
  private _query: string[] = [];

  getValue(value: number | bigint | string | Date) {
    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    } else if (typeof value === 'string') {
      return `'${escape(value)}'`;
    } else {
      return value.toISOString();
    }
  }

  exact(field: string, value: number | string | Date) {
    this._query.push(`${field}=${this.getValue(value)}`);
    return this;
  }

  compare(field: string, op: `${'<' | '>'}${'' | '='}`, value: number | bigint | Date) {
    this._query.push(`${field}${op}${this.getValue(value)}`);
    return this;
  }

  exists(field: string) {
    this._query.push(`${field} EXISTS`);
    return this;
  }

  contains(field: string, value: string) {
    this._query.push(`${field} CONTAINS '${escape(value)}'`);
    return this;
  }

  clone() {
    const q = new TendermintQuery();
    q._query = this._query.slice();
    return q;
  }

  toString() {
    return this._query.join(' AND ');
  }

  static AND(lhs: TendermintQuery, rhs: TendermintQuery) {
    const q = new TendermintQuery();
    q._query.push(`(${lhs}) AND (${rhs})`);
    return q;
  }

  static OR(lhs: TendermintQuery, rhs: TendermintQuery) {
    const q = new TendermintQuery();
    q._query.push(`(${lhs}) OR (${rhs})`);
    return q;
  }
}

/** Helper function to decode the bytes of a Cosmos SDK transaction.
 *
 * **Note** that the resulting type is not the same as this `Tx` class of this library, but instead
 * from `cosmjs-types/cosmos/tx/v1beta1/tx` which is directly built from the Cosmos SDK protobuf
 * definitions.
 */
export function decodeCosmosTx(bytes: string | Uint8Array) {
  if (typeof bytes === 'string') bytes = fromBase64(bytes);
  return SdkTx.decode(bytes);
}

function tryDecodeCosmosTx(bytes: string | Uint8Array) {
  try {
    return decodeCosmosTx(bytes);
  } catch {
    return typeof bytes === 'string' ? bytes : toBase64(bytes);
  }
}

/** Helper function to compute the transaction hash of a Cosmos SDK transaction. This hash can then
 * be used to query the transaction on the blockchain.
 */
export async function getCosmosTxHash(tx: SdkTx | string) {
  let bytes: Uint8Array;
  if (typeof tx === 'string') {
    bytes = fromBase64(tx);
  } else {
    bytes = SdkTx.encode(tx).finish();
  }

  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(buffer));
}
