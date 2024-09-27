import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { Any } from '../encoding/protobuf/any.js';
import { isMarshalledAny } from '../helpers.js';
import type { NetworkConfig } from '../networks.js';

export class BankSendMsg {
  static typeUrl = '/cosmos.bank.v1beta1.MsgSend';

  constructor(public fromAddress: string, public toAddress: string, public amount: Coin[]) {}

  /** Convenience method to convert this `BankSendMsg` into a protobuf `Any` type. To convert back, use `Any.decode`. */
  toAny(network: NetworkConfig) { return Any.encode(network, this) }

  /** Encode a wrapped `BankSendMsg` into a standard Cosmos SDK Bank Send message. */
  static encode(value: BankSendMsg) {
    return MsgSend.encode(value).finish();
  }

  /** Decode a standard Cosmos SDK Bank Send message into a wrapped `BankSendMsg`. */
  static decode(value: Uint8Array) {
    const { fromAddress, toAddress, amount } = MsgSend.decode(value);
    return new BankSendMsg(fromAddress, toAddress, amount);
  }
}

/** Marshal Unit to convert `SendMessage` to `Any` */
export const SendMessageMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof BankSendMsg
    ? morph({
        typeUrl: BankSendMsg.typeUrl,
        value: BankSendMsg.encode(value),
      })
    : pass,
  (value: any) => isMarshalledAny(value, BankSendMsg.typeUrl)
    ? morph(BankSendMsg.decode(value.value))
    : pass,
);

Any.defaultMarshalUnits.push(SendMessageMarshalUnit);
