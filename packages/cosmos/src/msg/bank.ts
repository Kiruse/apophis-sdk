import { registerDefaultProtobufs } from '@apophis-sdk/core/encoding/protobuf/any.js';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { registerDefaultAminos } from '../encoding/amino';
import { AnyMarshaller } from '@apophis-sdk/core/encoding/protobuf/marshaller.js';

export namespace Bank {
  export type SendData = {
    fromAddress: string;
    toAddress: string;
    amount: Coin[];
  }

  export class Send {
    static readonly protobufTypeUrl = '/cosmos.bank.v1beta1.MsgSend';
    static readonly aminoTypeUrl = 'cosmos-sdk/MsgSend';

    constructor(public data: SendData) {}

    static toProtobuf(value: Send): Uint8Array {
      return MsgSend.encode(MsgSend.fromPartial(value.data)).finish();
    }

    static fromProtobuf(value: Uint8Array): Send {
      const { fromAddress, toAddress, amount } = MsgSend.decode(value);
      return new Send({ fromAddress, toAddress, amount });
    }
  };

  registerDefaultProtobufs(Send);
  registerDefaultAminos(Send);
}
