import { RestMethods } from '@kiruse/restful';
import { BroadcastMode } from 'cosmjs-types/cosmos/tx/v1beta1/service.js';
import type { Tx as CosmosTransaction } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import { Protobuf } from './encoding';

export { BroadcastMode, CosmosTransaction };

export interface CosmosBlock {
  header: CosmosBlockHeader;
  data: {
    /** Transactions of this block, in base64 bytes. */
    txs: string[];
  };
  evidence: {
    evidence: CosmosEvidence[];
  };
  last_commit: CosmosBlockLastCommit;
}

export interface CosmosBlockHeader {
  version: CosmosBlockHeaderVersions;
  /** Same as the Chain ID we should already know */
  chain_id: string;
  height: bigint;
  time: Date;
  last_block_id: CosmosBlockId;
  /** Base64 bytes */
  last_commit_hash: string;
  /** Base64 bytes */
  data_hash: string;
  /** Base64 bytes */
  validators_hash: string;
  /** Base64 bytes */
  next_validators_hash: string;
  /** Base64 bytes */
  app_hash: string;
  /** Base64 bytes */
  evidence_hash: string;
  /** Base64 bytes, presumably of a utf8 string? */
  proposer_address: string;
}

export interface CosmosBlockId {
  /** Base64 bytes */
  hash: string;
  parts: {
    total: number;
    /** Base64 bytes */
    hash: string;
  };
}

export interface CosmosBlockHeaderVersions {
  block: bigint;
  app: bigint;
}

export interface CosmosBlockLastCommit {
  height: bigint;
  round: number;
  block_id: CosmosBlockId;
  signatures: CosmosBlockSignature[];
}

export interface CosmosBlockSignature {
  /** An enum in SHOUT_CASE */
  block_id_flag: string;
  validator_address: string;
  timestamp: Date;
  /** Signature base64 bytes */
  signature: string;
}

export type CosmosEvidence = unknown;

export interface CosmosBlockEventRaw {
  data: {
    type: string;
    value: {
      block: CosmosBlock;
      block_id: CosmosBlockId;
      /** Additional data on the finalized block.
       *
       * **Note:** I am not certain if this property is standard. Exert caution when using it.
       */
      result_finalize_block?: {
        app_hash: string;
        /** All events that happened in this block, in order. */
        events: CosmosEvent[];
        /** Results of each transaction in this block. */
        tx_results: CosmosTransactionResponse[];
      };
    };
  };
  /** A dictionary of event types to encountered values.
   *
   * **Note** that these events are not the same as the events in `CosmosTransactionResponse`. Rather,
   * these events are aggregates of all events that occurred in the block by type. Unlike
   * `CosmosTransactionResponse`, the exact order of events is not preserved, and it is not possible
   * to determine which event occurred in which transaction.
   */
  events: Record<string, string[]>;
  /** Tendermint query used to match this block. */
  query: string;
}

export interface CosmosBlockEvent {
  header: CosmosBlockHeader;
  lastCommit: CosmosBlockLastCommit;
  /** SDK transactions found in this block. While Crypto-Me attempts to deserialize them, malformed transactions are kept as base64 byte strings. */
  txs: (CosmosTransaction | string)[];
  txResults: CosmosTransactionResponse[];
  evidence: CosmosEvidence[];
  events: CosmosEvent[];
}

export interface CosmosTransactionResult {
  code?: number;
  codespace?: string;
  data: string;
  info: string;
  log: string;
  gas_wanted: bigint;
  gas_used: bigint;
  /** All events that occurred during this transaction, including those contained in `logs[].events`. */
  events: CosmosEvent[];
}

export interface CosmosTransactionResponse extends Omit<CosmosTransactionResult, 'log'> {
  height: bigint;
  // seems non-standard
  // tx: CosmosTransaction;
  txhash: string;
  /** Raw JSON string */
  raw_log: string;
  /** Logs corresponding to the various messages in this transaction, including triggered events. */
  logs: CosmosLog[];
}

export interface CosmosTransactionEventRaw {
  data: {
    type: string;
    value: {
      tx_result: {
        height: bigint;
        index: number;
        /** Transaction result. Easiest to check for success is to test for `'code' in event.data.value.tx_result.result`. */
        result: CosmosError | {
          /** Base64 bytes */
          data: string;
          events: CosmosEvent[];
          gas_wanted: bigint;
          gas_used: bigint;
        };
        /** Transaction bytes in base64. You can decode this data with the `decodeCosmosTx` method from this library. */
        tx: string;
      };
    };
  };
  /** A dictionary of event types to encountered values.
   *
   * **Note** that these events essentially contain the same information as `CosmosTransactionResponse.events`,
   * but are aggregated by type. Unlike `CosmosTransactionResponse`, the exact order of events is not preserved.
   * However, events in their correct ordering are also contained in this response at
   * `.data.value.TxResult.result.events`.
   */
  events: Record<string, string[]>;
  /** Tendermint query used to match this transaction. */
  query: string;
}

export type CosmosTransactionEvent = {
  height: bigint;
  index: number;
} & (
  | {
      error: CosmosError;
      result?: undefined;
      /** Bytes of the transaction. This is kept as bytes as a common error is a malformed tx. */
      txBytes: string;
    }
    | {
      tx: CosmosTransaction;
      txhash: string;
      result: {
        data: string;
        events: CosmosEvent[];
        gas_wanted: bigint;
        gas_used: bigint;
      };
      error?: undefined;
    }
)

export interface CosmosLog {
  msg_index: number;
  log: string;
  /** Events that occurred during execution of the corresponding message. */
  events: CosmosEvent[];
}

export interface CosmosEvent {
  /** An arbitrary, smart contract or SDK module defined event type. */
  type: string;
  /** Attributes are typically human readable key/value pairs */
  attributes: {
    key: string;
    value: string;
    /** Whether this attribute is used as index */
    index?: boolean;
  }[];
}

export interface CosmosError {
  code: number;
  codespace: string;
  log: string;
}

export interface Pagination {
  'pagination.key': string;
  'pagination.offset': number;
  'pagination.limit': number;
  'pagination.count_total'?: boolean;
  'pagination.reverse'?: boolean;
}

export interface PaginationResponse {
  next_key: string;
  total: bigint;
}

export type BasicRestApi = {
  cosmos: {
    auth: {
      v1beta1: {
        account_info: {
          [address: string]: RestMethods<{
            get(): {
              account_number: bigint;
              address: string;
              pub_key: Protobuf.Any;
              sequence: bigint;
            };
          }>;
        };
      };
    };

    base: {
      tendermint: {
        v1beta1: {
          abci_query: RestMethods<{
            get(opts: {
              /** Query data in base64 bytes */
              data: string;
              path: string;
              height: number;
              prove: boolean;
            }): {
              code: number;
              codespace: string;
              height: bigint;
              index: bigint;
              info: string;
              key: string;
              log: string;
              proof_ops: {
                ops: {
                  /** Base64 bytes */
                  data: string;
                  key: string;
                  type: string;
                }[];
              };
              value: string;
            };
          }>;

          /** Gets a block by its integral height. Should be a bigint stringified, or "latest". */
          blocks: {
            [height: string]: RestMethods<{
              get(): {
                block_id: CosmosBlockId;
                block: CosmosBlock;
              };
            }>;
          };
        };
      };
    };

    tx: {
      v1beta1: {
        decode: RestMethods<{
          post(body: { tx_bytes: string | Uint8Array }): { tx: CosmosTransaction };
        }> & {
          amino: RestMethods<{
            post(body: { amino_binary: string | Uint8Array }): { amino_json: string };
          }>;
        };

        encode: RestMethods<{
          post(body: { tx: CosmosTransaction }): { tx_bytes: string };
        }> & {
          amino: RestMethods<{
            post(body: { amino_json: string }): { amino_binary: string };
          }>;
        };

        txs: RestMethods<{
          get(opts: Pagination & {
            events: string[];
            query: string;
            order?: Order;
            page?: bigint;
            limit?: bigint;
          }): PaginationResponse & {
            total: bigint;
            txs: CosmosTransaction[];
            tx_responses: CosmosTransactionResponse[];
          };

          post(body: {
            mode: BroadcastMode;
            tx_bytes: string | Uint8Array;
          }): {
            tx_response: CosmosTransactionResponse;
          };
        }> & ({
          block: {
            [height: string]: RestMethods<{
              get(opts: Pagination): {
                block_id: CosmosBlockId;
                block: CosmosBlock;
                txs: CosmosTransaction[];
                pagination: PaginationResponse;
              };
            }>;
          };
        } | {
          [hash: string]: RestMethods<{
            get(): {
              tx: CosmosTransaction;
              tx_response: CosmosTransactionResponse;
            };
          }>;
        });

        simulate: RestMethods<{
          post(body: { tx: CosmosTransaction, tx_bytes: string | Uint8Array }): {
            gas_info: {
              gas_used: bigint;
              gas_wanted: bigint;
            };
            result: {
              data: string;
              events: CosmosEvent[];
              log: string;
              msg_responses: Protobuf.Any[];
            };
          };
        }>;
      };
    };
  };

  cosmwasm: {
    wasm: {
      v1: {
        code: {
          [codeId: number | string]: RestMethods<{
            get(): {
              code_info: {
                code_id: bigint;
                creator: string;
                /** Base64 hash bytes */
                data_hash: string;
                instantiate_permission: {
                  addresses?: string[];
                  permission: string;
                };
              };
              /** Base64 contract code WASM bytes */
              data: string;
            };
          }> & {
            contracts: RestMethods<{
              get(options: Pagination): {
                /** Contract addresses */
                contracts: string[];
                pagination: PaginationResponse;
              };
            }>;
          };
        };

        contract: {
          [address: string]: RestMethods<{
            get(): {
              address: string;
              contract_info: {
                admin: string;
                code_id: bigint;
                created: {
                  block_height: bigint;
                  tx_index: bigint;
                };
                creator: string;
                extension: Protobuf.Any;
                ibc_port_id?: string;
                label: string;
              };
            };
          }> & {
            /** Get raw contract state by raw binary key. */
            raw: {
              [key: string]: RestMethods<{
                get(): {
                  /** The value associated with the given key, in base64 bytes. */
                  data: string;
                };
              }>;
            };

            /** Execute smart query on the contract. `query` is a contract-specific binary encoding, typically JSON in base64. */
            smart: {
              [query: string]: RestMethods<{
                get(): {
                  /** The result of the smart query, in base64 bytes. */
                  data: string;
                };
              }>;
            };

            state: RestMethods<{
              get(options?: Pagination): {
                models: {
                  /** Key bytes in base64 */
                  key: string;
                  /** Value bytes in base64 */
                  value: string;
                }[];
                pagination: PaginationResponse;
              };
            }>;
          };
        };

        contracts: {
          /** Gets the contracts by creator */
          creator: {
            [address: string]: RestMethods<{
              get(options?: Pagination): {
                contract_addresses: string[];
                pagination: PaginationResponse;
              };
            }>;
          };
        };
      };
    };
  };
};

export namespace WS {
  export interface SearchTxsParams {
    pageSize?: number | bigint;
    page?: number;
    order?: 'asc' | 'desc';
    prove?: boolean;
  }

  export interface SearchTxsResponse {
    total_count: bigint;
    txs: SearchTxsResponseTx[];
  }

  export interface SearchTxsResponseTx {
    hash: string;
    height: bigint;
    index: number;
    /** Merkle proof of this tx */
    proof: unknown;
    /** Bytes of a `CosmosTransaction` */
    tx: string;
    /** Results corresponding to each tx in order. */
    tx_result: CosmosTransactionResult;
  }
}

export enum Order {
  Unspecified = 'ORDER_BY_UNSPECIFIED',
  Ascending = 'ORDER_BY_ASC',
  Descending = 'ORDER_BY_DESC',
}
