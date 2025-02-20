import { registerDefaultProtobufs } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { Coin } from '@apophis-sdk/core/types.sdk.js';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { registerDefaultAminos } from '../encoding/amino';
import { TxMarshaller } from 'src/tx';
import { Cosmos } from 'src/api';

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
      return MsgSend.encode(MsgSend.fromPartial(TxMarshaller.marshal(value.data) as any)).finish();
    }

    static fromProtobuf(value: Uint8Array): Send {
      const { fromAddress, toAddress, amount } = TxMarshaller.unmarshal(MsgSend.decode(value)) as SendData;
      return new Send({ fromAddress, toAddress, amount });
    }
  };

  registerDefaultProtobufs(Send);
  registerDefaultAminos(Send);
}
