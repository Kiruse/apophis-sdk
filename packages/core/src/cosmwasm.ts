import { extendDefaultMarshaller, ToJsonMarshalUnit } from '@kiruse/marshal';
import { Cosmos } from './api';
import { BytesMarshalUnit } from './marshal';
import { ExecuteContractMsg, InstantiateContractMsg, StoreCodeMsg } from './msg/wasm';
import { type NetworkConfig } from './networks';
import { type Signer } from './signer';
import { BroadcastMode, Coin, TransactionResponse } from './types.sdk';
import { fromBase64, fromUtf8, toBase64, toUtf8 } from './utils';

export interface InstantiateOptions {
  network: NetworkConfig;
  signer: Signer;
  codeId: bigint;
  label: string;
  msg: Uint8Array;
  admin?: string;
  funds?: Coin[];
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
  async store(network: NetworkConfig, signer: Signer, code: Uint8Array) {
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
  async execute(network: NetworkConfig, signer: Signer, contractAddress: string, msg: Uint8Array, funds: Coin[] = []): Promise<TransactionResponse> {
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
    /** The smart query is the most common query type which defers to the smart contract.
     * Other types of queries exist but are currently not supported by *Apophis SDK*.
     */
    async smart(network: NetworkConfig, contractAddress: string, queryMsg: Uint8Array) {
      const result = await Cosmos.rest(network).cosmwasm.wasm.v1.contract[contractAddress].smart[toBase64(queryMsg)]('GET');
      if ((result as any).code) {
        throw new Error('Failed to perform smart query');
      }
      return CosmWasm.fromBinary(fromBase64(result.data));
    }
  }

  toBinary(value: any): Uint8Array {
    return fromUtf8(JSON.stringify(this.marshaller.marshal(value)));
  }

  fromBinary(value: Uint8Array): unknown {
    return this.marshaller.unmarshal(JSON.parse(toUtf8(value)));
  }
}

export const CosmWasm = new CosmWasmApi();
