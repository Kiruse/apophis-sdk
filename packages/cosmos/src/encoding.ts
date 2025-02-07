import { Any, CosmosNetworkConfig } from '@apophis-sdk/core';
import { mw } from '@apophis-sdk/core/middleware.js';
import { CosmosTxFormat } from 'src/tx';

/** In Cosmos, transactions consist of one or more consecutive messages, and transactions can be
 * encoded in either Amino or ProtoBuf. Amino is the legacy format, thus, systems must support at
 * least ProtoBuf. However, legacy systems such as Ledger only support Amino. It is thus advised
 * to support both formats - but not every SDK module does.
 */
export interface CosmosMessage {
  /** The type of the message in the ProtoBuf format. Required. */
  readonly protobufType: string;
  /** The type of the message in the Amino format, if any. */
  readonly aminoType?: string;
}

/** The Amino-encoded Cosmos Message is very similar to a protobuf `Any` type, except the data is not
 * binary-encoded rather than JSON-encoded.
 */
export type AminoMsg<T1 extends string = string, T2 = any> = {
  type: T1;
  value: T2;
}

export type EncodedCosmosMessage = Any | AminoMsg;

export function encodeCosmosMessage(network: CosmosNetworkConfig, message: CosmosMessage, format: 'amino'): AminoMsg;
export function encodeCosmosMessage(network: CosmosNetworkConfig, message: CosmosMessage, format: 'protobuf'): Any;
export function encodeCosmosMessage(network: CosmosNetworkConfig, message: CosmosMessage, format: CosmosTxFormat): EncodedCosmosMessage;
export function encodeCosmosMessage(network: CosmosNetworkConfig, message: any, format: CosmosTxFormat): EncodedCosmosMessage {
  return mw('encoding', format, 'encode').inv().fifo(network, message) as any;
}

export function decodeCosmosMessage(network: CosmosNetworkConfig, message: AminoMsg, format: 'amino'): CosmosMessage;
export function decodeCosmosMessage(network: CosmosNetworkConfig, message: Any, format: 'protobuf'): CosmosMessage;
export function decodeCosmosMessage(network: CosmosNetworkConfig, message: EncodedCosmosMessage, format: CosmosTxFormat): CosmosMessage;
export function decodeCosmosMessage(network: CosmosNetworkConfig, message: any, format: CosmosTxFormat): CosmosMessage {
  return mw('encoding', format, 'decode').inv().fifo(network, message) as any;
}

export const Amino = {
  encode: encodeCosmosMessage,
  decode: decodeCosmosMessage,
};
