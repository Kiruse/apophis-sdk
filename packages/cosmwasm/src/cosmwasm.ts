import { BytesMarshalUnit } from '@apophis-sdk/core/marshal.js';
import { ExecuteContractMsg, InstantiateContractMsg, StoreCodeMsg } from './msgs.js';
import { type CosmosNetworkConfig } from '@apophis-sdk/core/networks.js';
import { type Signer } from '@apophis-sdk/core/signer.js';
import type { Coin, TransactionResponse } from '@apophis-sdk/core/types.sdk.js';
import { fromBase64, fromHex, fromUtf8, toBase64, toUtf8 } from '@apophis-sdk/core/utils.js';
import { Cosmos } from '@apophis-sdk/cosmos';
import { extendDefaultMarshaller, ToJsonMarshalUnit } from '@kiruse/marshal';

export interface InstantiateOptions {
  network: CosmosNetworkConfig;
  signer: Signer;
  codeId: bigint;
  label: string;
  msg: Uint8Array;
  admin?: string;
  funds?: Coin[];
}

export interface StateItem {
  /** The key path of the value. Standard CosmWasm smart contracts generate predictable key paths.
   * In that case, `keypath` is an array of decoded strings. Otherwise, it is a raw binary encoding.
   */
  keypath: string[] | Uint8Array;
  /** Raw binary value of the state item. Its meaning depends entirely on the contract. */
  value: Uint8Array;
}

export interface ContractInfo {
  contract: string;
  version: string;
}

export const baseCosmWasmMarshaller = extendDefaultMarshaller([
  BytesMarshalUnit,
  ToJsonMarshalUnit,
]);

export class CosmWasmApi {
  constructor(
    public readonly marshaller = baseCosmWasmMarshaller,
  ) {}

  /** Convenience function to store the given contract code on-chain. Waits for block inclusion & returns the new code's ID. */
  async store(network: CosmosNetworkConfig, signer: Signer, code: Uint8Array) {
    const tx = Cosmos.tx([
      new StoreCodeMsg({ sender: signer.address(network), wasmByteCode: code }).toAny(network),
    ]);

    const { gasLimit } = await tx.estimateGas(network, signer);
    tx.computeGas(network, gasLimit + 50000n, true);

    await signer.sign(network, tx);
    await Cosmos.ws(network).ready(10000);
    const resultPromise = Cosmos.ws(network).expectTx(tx);
    await tx.broadcast();

    const result = await resultPromise;

    const codeIds = Cosmos.getEventValues(result.events, 'store_code', 'code_id');
    if (codeIds.length === 0)
      throw new Error('Failed to store code: no code IDs found in transaction logs');
    if (codeIds.length > 1)
      console.warn('Unexpected number of code IDs in transaction logs, returning first:', codeIds);
    return BigInt(codeIds[0]);
  }

  /** Convenience function to instantiate a contract from a previously stored code. Waits for block inclusion & returns the new contract's address. */
  async instantiate({ network, signer, codeId, label, admin, msg, funds = [] }: InstantiateOptions): Promise<string> {
    const tx = Cosmos.tx([
      new InstantiateContractMsg({
        admin: admin ?? signer.address(network),
        sender: signer.address(network),
        codeId,
        label,
        msg,
        funds,
      }).toAny(network),
    ]);

    const { gasLimit } = await tx.estimateGas(network, signer);
    tx.computeGas(network, gasLimit + 50000n, true);

    await signer.sign(network, tx);
    await Cosmos.ws(network).ready(10000);
    const resultPromise = Cosmos.ws(network).expectTx(tx);
    await tx.broadcast();

    const result = await resultPromise;

    const contractAddress = Cosmos.getEventValues(result.events, 'instantiate', '_contract_address');
    if (contractAddress.length === 0)
      throw new Error('Failed to instantiate contract: no contract address found in transaction logs');
    if (contractAddress.length > 1)
      console.warn('Unexpected number of contract addresses in transaction logs, returning first:', contractAddress);
    return contractAddress[0];
  }

  /** Convenience function to invoke a contract execution. Waits for block inclusion & returns the transaction response. */
  async execute(network: CosmosNetworkConfig, signer: Signer, contractAddress: string, msg: Uint8Array, funds: Coin[] = []): Promise<TransactionResponse> {
    const tx = Cosmos.tx([
      new ExecuteContractMsg({
        sender: signer.address(network),
        contract: contractAddress,
        msg,
        funds,
      }).toAny(network),
    ]);

    const { gasLimit } = await tx.estimateGas(network, signer);
    tx.computeGas(network, gasLimit + 50000n, true);

    await signer.sign(network, tx);
    await Cosmos.ws(network).ready(10000);
    const resultPromise = Cosmos.ws(network).expectTx(tx);
    await tx.broadcast();

    await resultPromise;
    return await Cosmos.ws(network).getTx(tx.hash);
  }

  query = new class {
    constructor(public readonly api: CosmWasmApi) {}

    /** Query raw contract state using the `keypath`. Knowing the keypath requires deeper knowledge of the smart contract code. */
    async raw(network: CosmosNetworkConfig, contractAddress: string, keypath: string[] | Uint8Array) {
      if (!(keypath instanceof Uint8Array)) keypath = encodeKeypath(keypath);
      const key = keypath instanceof Uint8Array ? toBase64(keypath) : keypath;
      const { data } = await Cosmos.rest(network).cosmwasm.wasm.v1.contract[contractAddress].raw[key]('GET');
      if (data === null) return null;
      return fromBase64(data);
    }

    /** The smart query is the most common query type which defers to the smart contract.
     * Other types of queries exist but are currently not supported by *Apophis SDK*.
     *
     * You can get the binary representation of the query message using the `toBinary` method. The
     * data returned depends on the smart contract code but is typically a JSON object, for which
     * this method accepts a type parameter.
     */
    async smart<T = unknown>(network: CosmosNetworkConfig, contractAddress: string, queryMsg: Uint8Array) {
      const result = await Cosmos.rest(network).cosmwasm.wasm.v1.contract[contractAddress].smart[toBase64(queryMsg)]('GET');
      if ((result as any).code) {
        throw new Error('Failed to perform smart query');
      }
      return result.data as T;
    }

    /** State is a rarely used query type which can be used to iterate over all state items of a
     * contract, whether they are exposed through smart queries or not. However, they also require
     * deeper knowledge of the contract's state structure and the cosmwasm-std specification.
     *
     * The `nextKey` parameter is used to paginate through the state items and is generally returned
     * by the previous call to this method.
     */
    async state(network: CosmosNetworkConfig, contractAddress: string, nextKey: string = '') {
      const { models, pagination } = await Cosmos.rest(network).cosmwasm.wasm.v1.contract[contractAddress].state('GET', {
        query: {
          'pagination.key': nextKey,
          'pagination.offset': 0,
          'pagination.limit': 100,
        },
      });

      return {
        pagination,
        items: models.map(model => ({
          keypath: decodeKeypathMaybe(fromHex(model.key)),
          value: fromBase64(model.value),
        })),
      };
    }

    /** Attempt to query the CW2 standard contract info. */
    async contractInfo(network: CosmosNetworkConfig, contractAddress: string) {
      const data = await this.raw(network, contractAddress, ['contract_info']);
      if (data === null) return null;
      return this.api.marshaller.unmarshal(JSON.parse(toUtf8(data))) as ContractInfo;
    }
  }(this);

  toBinary(value: any): Uint8Array {
    return fromUtf8(JSON.stringify(this.marshaller.marshal(value)));
  }

  fromBinary(value: Uint8Array): unknown {
    return this.marshaller.unmarshal(JSON.parse(toUtf8(value)));
  }
}

export const CosmWasm = new CosmWasmApi();

export function encodeKeypath(keypath: string[]): Uint8Array {
  if (keypath.length === 0)
    throw new Error('Keypath cannot be empty');
  // the -2 is to account for the fact that the last key is not preceded by a length
  const buffer = new ArrayBuffer(keypath.reduce((acc, key) => acc + key.length + 2, -2));
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  const last = keypath.pop()!;
  for (const key of keypath) {
    view.setUint16(offset, key.length, false);
    offset += 2;
    const keyBytes = fromUtf8(key);
    bytes.set(keyBytes, offset);
    offset += keyBytes.length;
  }
  bytes.set(fromUtf8(last), offset);
  return bytes;
}

export function decodeKeypath(keypath: Uint8Array): string[] {
  const view = new DataView(keypath.buffer);
  const result: string[] = [];
  let offset = 0;
  let isLast = false;
  while (offset < keypath.length) {
    const keyLength = view.getUint16(offset, false);
    if (offset + 2 + keyLength > keypath.length) {
      isLast = true;
      break;
    }
    offset += 2;
    result.push(toUtf8(keypath.subarray(offset, offset + keyLength)));
    offset += keyLength;
  }
  if (!isLast)
    throw new Error('Non-standard keypath encoding');
  result.push(toUtf8(keypath.subarray(offset)));
  return result;
}

export function decodeKeypathMaybe(keypath: Uint8Array): string[] | Uint8Array {
  try {
    return decodeKeypath(keypath);
  } catch {
    return keypath;
  }
}
