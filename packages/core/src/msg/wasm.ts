import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgStoreCode, MsgInstantiateContract, MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { Any } from '../encoding/protobuf/any.js';
import { isMarshalledAny } from '../helpers.js';
import type { NetworkConfig } from '../networks.js';

export class StoreCodeMsg {
  static typeUrl = '/cosmwasm.wasm.v1.MsgStoreCode';

  constructor(public data: { sender: string, wasmByteCode: Uint8Array }) {}

  toAny(network: NetworkConfig) { return Any.encode(network, this) }

  static encode(value: StoreCodeMsg) {
    return MsgStoreCode.encode(value.data).finish();
  }

  static decode(value: Uint8Array) {
    const { sender, wasmByteCode } = MsgStoreCode.decode(value);
    return new StoreCodeMsg({ sender, wasmByteCode });
  }
}

export class InstantiateContractMsg {
  static typeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract';

  constructor(public data: { admin: string, sender: string, codeId: bigint, label: string, msg: Uint8Array, funds: Coin[] }) {}

  toAny(network: NetworkConfig) { return Any.encode(network, this) }

  static encode(value: InstantiateContractMsg) {
    return MsgInstantiateContract.encode(value.data).finish();
  }

  static decode(value: Uint8Array) {
    const { admin, sender, codeId, label, msg, funds } = MsgInstantiateContract.decode(value);
    return new InstantiateContractMsg({ admin, sender, codeId, label, msg, funds });
  }
}

export class ExecuteContractMsg {
  static typeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract';

  constructor(public data: { sender: string, contract: string, msg: Uint8Array, funds: Coin[] }) {}

  toAny(network: NetworkConfig) { return Any.encode(network, this) }

  static encode(value: ExecuteContractMsg) {
    return MsgExecuteContract.encode(value.data).finish();
  }

  static decode(value: Uint8Array) {
    const { sender, contract, msg, funds } = MsgExecuteContract.decode(value);
    return new ExecuteContractMsg({ sender, contract, msg, funds });
  }
}

export const StoreCodeMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof StoreCodeMsg
    ? morph({
        typeUrl: StoreCodeMsg.typeUrl,
        value: StoreCodeMsg.encode(value),
      })
    : pass,
  (value: any) => isMarshalledAny(value, StoreCodeMsg.typeUrl)
    ? morph(StoreCodeMsg.decode(value.value))
    : pass,
);

export const InstantiateContractMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof InstantiateContractMsg
    ? morph({
        typeUrl: InstantiateContractMsg.typeUrl,
        value: InstantiateContractMsg.encode(value),
      })
    : pass,
  (value: any) => isMarshalledAny(value, InstantiateContractMsg.typeUrl)
    ? morph(InstantiateContractMsg.decode(value.value))
    : pass,
);

export const ExecuteContractMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof ExecuteContractMsg
    ? morph({
        typeUrl: ExecuteContractMsg.typeUrl,
        value: ExecuteContractMsg.encode(value),
      })
    : pass,
  (value: any) => isMarshalledAny(value, ExecuteContractMsg.typeUrl)
    ? morph(ExecuteContractMsg.decode(value.value))
    : pass,
);

Any.defaultMarshalUnits.push(
  StoreCodeMarshalUnit,
  InstantiateContractMarshalUnit,
  ExecuteContractMarshalUnit,
);
