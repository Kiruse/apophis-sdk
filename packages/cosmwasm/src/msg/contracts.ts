import { registerDefaultProtobufs } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { Coin } from '@apophis-sdk/core/types.sdk.js';
import { TxMarshaller } from '@apophis-sdk/cosmos';
import { registerDefaultAminos } from '@apophis-sdk/cosmos/encoding/amino.js';
import { MsgExecuteContract, MsgInstantiateContract, MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js';

export namespace Contract {
  export interface StoreCodePayload {
    sender?: string;
    wasmByteCode: Uint8Array;
  }

  export class StoreCode {
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgStoreCode';
    static readonly aminoTypeUrl = 'wasm/MsgStoreCode';

    constructor(public data: StoreCodePayload) {}

    static toProtobuf(value: StoreCode): Uint8Array {
      return MsgStoreCode.encode(MsgStoreCode.fromPartial(value.data)).finish();
    }

    static fromProtobuf(value: Uint8Array): StoreCode {
      const data = MsgStoreCode.decode(value);
      return new StoreCode({
        sender: data.sender,
        wasmByteCode: data.wasmByteCode,
      });
    }
  }

  export interface InstantiatePayload {
    admin?: string;
    sender: string;
    codeId: bigint;
    label: string;
    msg: Uint8Array;
    funds?: Coin[];
  }

  export class Instantiate {
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract';
    static readonly aminoTypeUrl = 'wasm/MsgInstantiateContract';

    constructor(public data: InstantiatePayload) {}

    static toProtobuf(value: Instantiate): Uint8Array {
      return MsgInstantiateContract.encode(MsgInstantiateContract.fromPartial(
        TxMarshaller.marshal(value.data) as any
      )).finish();
    }

    static fromProtobuf(value: Uint8Array): Instantiate {
      const data = TxMarshaller.unmarshal(MsgInstantiateContract.decode(value)) as InstantiatePayload;
      return new Instantiate({
        admin: data.admin,
        sender: data.sender,
        codeId: data.codeId,
        label: data.label,
        msg: data.msg,
        funds: data.funds ?? [],
      });
    }
  }

  export interface ExecutePayload {
    sender: string;
    contract: string;
    msg: Uint8Array;
    funds?: Coin[];
  }

  export class Execute {
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract';
    static readonly aminoTypeUrl = 'wasm/MsgExecuteContract';

    constructor(public data: ExecutePayload) {}

    static toProtobuf(value: Execute): Uint8Array {
      return MsgExecuteContract.encode(MsgExecuteContract.fromPartial(
        TxMarshaller.marshal(value.data) as any
      )).finish();
    }

    static fromProtobuf(value: Uint8Array): Execute {
      const data = TxMarshaller.unmarshal(MsgExecuteContract.decode(value)) as ExecutePayload;
      return new Execute({
        sender: data.sender,
        contract: data.contract,
        msg: data.msg,
        funds: data.funds ?? [],
      });
    }
  }

  registerDefaultAminos(StoreCode, Instantiate, Execute);
  registerDefaultProtobufs(StoreCode, Instantiate, Execute);
}
