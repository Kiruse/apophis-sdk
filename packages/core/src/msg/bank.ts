import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { Any } from '../encoding/protobuf/any.js';
import { isMarshalledAny } from '../helpers.js';

export class SendMessage {
  static typeUrl = '/cosmos.bank.v1beta1.MsgSend';

  constructor(public fromAddress: string, public toAddress: string, public amount: Coin[]) {}

  static encode(value: SendMessage) {
    return MsgSend.encode(value).finish();
  }

  static decode(value: Uint8Array) {
    const { fromAddress, toAddress, amount } = MsgSend.decode(value);
    return new SendMessage(fromAddress, toAddress, amount);
  }
}

/** Marshal Unit to convert `SendMessage` to `Any` */
export const SendMessageMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof SendMessage
    ? morph({
        typeUrl: SendMessage.typeUrl,
        value: SendMessage.encode(value),
      })
    : pass,
  (value: any) => isMarshalledAny(value, SendMessage.typeUrl)
    ? morph(SendMessage.decode(value.value))
    : pass,
);

Any.defaultMarshalUnits.push(SendMessageMarshalUnit);
