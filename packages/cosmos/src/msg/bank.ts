import { registerDefaultProtobufs } from '@apophis-sdk/core/encoding/protobuf/any.js';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { registerDefaultAminos } from '../encoding/amino';

export type BankSendData = {
  fromAddress: string;
  toAddress: string;
  amount: Coin[];
}

export class BankSendMsg {
  static readonly protobufTypeUrl = '/cosmos.bank.v1beta1.MsgSend';
  static readonly aminoTypeUrl = 'cosmos-sdk/MsgSend';

  constructor(public data: BankSendData) {}

  static toProtobuf(value: BankSendMsg): Uint8Array {
    return MsgSend.encode(value.data).finish();
  }

  static fromProtobuf(value: Uint8Array): BankSendMsg {
    const { fromAddress, toAddress, amount } = MsgSend.decode(value);
    return new BankSendMsg({ fromAddress, toAddress, amount });
  }
}

registerDefaultProtobufs(BankSendMsg);
registerDefaultAminos(BankSendMsg);

export namespace Bank {
  export const Send = BankSendMsg;
}
