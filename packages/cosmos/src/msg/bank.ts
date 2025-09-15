import { CosmosNetworkConfig } from '@apophis-sdk/core';
import { registerDefaultProtobufSchema } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { hpb } from '@kiruse/hiproto';
import { Cosmos } from '../api.js';
import { registerDefaultAminos } from '../encoding/amino.js';
import { pbCoin } from '../encoding/protobuf/core.js';

export namespace Bank {
  export type DenomMetadata = hpb.infer<typeof Query.pbMetadata>;

  //#region Send
  export type SendData = hpb.infer<typeof pbSendData>;

  export const pbSendData = hpb.message({
    fromAddress: hpb.string(1),
    toAddress: hpb.string(2),
    amount: hpb.repeated.submessage(3, pbCoin),
  });

  export class Send {
    static readonly aminoTypeUrl = 'cosmos-sdk/MsgSend';
    static readonly protobufTypeUrl = '/cosmos.bank.v1beta1.MsgSend';
    static readonly protobufSchema = pbSendData;
    constructor(public data: SendData) {}
  };

  registerDefaultProtobufSchema(Send);
  registerDefaultAminos(Send);
  //#endregion

  export namespace Query {
    //#region DenomMetadata
    export const pbMetadata = hpb.message({
      description: hpb.string(1),
      denomUnits: hpb.repeated.submessage(2, {
        denom: hpb.string(1),
        exponent: hpb.uint32(2),
        aliases: hpb.repeated.string(3),
      }),
      base: hpb.string(3),
      display: hpb.string(4),
      name: hpb.string(5),
      symbol: hpb.string(6),
      uri: hpb.string(7),
      uriHash: hpb.string(8),
    });

    export async function getDenomMetadata(network: CosmosNetworkConfig, denom: string) {
      return await Cosmos.rest(network).cosmos.bank.v1beta1.denoms_metadata[denom]('GET');
    }
    //#endregion
  }
}
