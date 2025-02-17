// Amino is a legacy encoding format used in the Cosmos SDK. It is a JSON variant where object keys
// are sorted alphabetically to avoid ambiguity of hashes.
// This format has been deprecated in favor of protobuf, but is still used in many places,
// particularly in the Ledger Cosmos app.

import { CosmosNetworkConfig } from '@apophis-sdk/core';
import { mw } from '@apophis-sdk/core/middleware.js';
import type { Bytes, NetworkConfig } from '@apophis-sdk/core/types.js';
import type { Coin } from '@apophis-sdk/core/types.sdk.js';
import { extendDefaultMarshaller } from '@kiruse/marshal';

import { defineMarshalUnit, morph, pass, RecaseMarshalUnit } from '@kiruse/marshal';
import { recase } from '@kristiandupont/recase';

/** Descriptor for a type that can be de/serialized to/from Amino. */
export interface AminoType<T1 extends string = string, T2 = any> {
  get aminoTypeUrl(): T1;
  new(data: T2): { get data(): T2 };
}

/** The Amino-encoded Cosmos Message is very similar to a protobuf `Any` type, except the data is not
 * binary-encoded rather than JSON-encoded.
 *
 * @param T1 - Exact Amino type URL. This is always a string, but can be more specific for type safety.
 * @param T2 - Actual message payload, unencoded (i.e. not stringified).
 */
export type AminoMsg<T1 extends string = string, T2 = any> = {
  type: T1;
  value: T2;
}

export interface AminoTx {
  msg: AminoMsg[];
  fee: AminoFee;
  signatures: AminoSignature[];
  memo: string;
}

export interface AminoFee {
  amount: Coin[];
  gas: string;
}

/** There are 3 types of pubkeys that the Cosmos SDK supports for the Amino encoding:
 *
 * - `tendermint/PubKeySecp256k1` is the most common pubkey used for EOAccounts.
 * - `tendermint/PubKeySecp256r1` is a variation of secp256k1 with longer addresses. There's probably more to it but I haven't been able to find any documentation.zs
 * - `tendermint/PubKeyEd25519` is typically used for validators, but also finds use for EOAs in EVM chains.
 * - `tendermint/PubKeySr25519` is a legacy type that is no longer supported in modern Cosmos SDK
 *   versions. It is included here for blockchains using older SDK versions.
 * - `tendermint/PubKeyMultisigThreshold` is a legacy type for multisig accounts that only supports Amino encoding.
 *
 * However, the Apophis SDK currently only supports the `tendermint/PubKeySecp256k1` type, though
 * you can still manually compute the other pubkey bytes.
 */
export type AminoPubkey = AminoMsg<
  | `tendermint/PubKey${'Secp256k1' | 'Secp256r1' | 'Ed25519' | 'Sr25519' | 'MultisigThreshold'}`
  | 'cometbft/PubKeyBls12_381',
  Bytes
>;

export interface AminoSignature {
  pubKey: AminoPubkey;
  signature: Bytes;
}

/** A Marshal Unit which sorts the keys of an object. This is used to normalize JSON structures in
 * the legacy Amino encoding used in the Cosmos ecosystem.
 */
export const SortedObjectMarshalUnit = defineMarshalUnit(
  (value: any, { marshal }) => {
    if (typeof value !== 'object' || !value || Array.isArray(value)) return pass;
    const keys = Object.keys(value);
    const sortedKeys = keys.toSorted();
    let changed = false;
    const sorted = sortedKeys.reduce((acc, key, index) => {
      changed = changed || keys[index] !== key;
      return { ...acc, [key]: value[key] };
    }, {} as Record<string, unknown>);
    return changed ? morph(marshal(sorted)) : pass;
  },
  // there's absolutely no need to unmarshal sorted objects
  () => pass,
  // always run last so specialized marshal units can turn complex objects into POJOs
  true,
);

/** Raw list of marshal units used for amino encoding of Cosmos messages. */
export const defaultAminoMarshalUnits = [
  SortedObjectMarshalUnit,
  RecaseMarshalUnit(
    recase('mixed', 'snake'),
    recase('snake', 'camel'),
  ),
];
/** Marshaller for amino encoding of Cosmos messages. */
export const AminoMarshaller = extendDefaultMarshaller(defaultAminoMarshalUnits);

export namespace Amino {
  export function encode(network: CosmosNetworkConfig, value: any) {
    const mwstack = mw('encoding', 'encode').inv();
    const res = mwstack.fifo(network, 'amino', value);
    if (!isAmino(res)) throw new Error('Invalid amino message');
    return res;
  }

  export function decode(network: CosmosNetworkConfig, value: AminoMsg) {
    const mwstack = mw('encoding', 'decode').inv();
    return mwstack.fifo(network, 'amino', value);
  }

  export function isAmino<T1 extends string = string, T2 = any>(message: any): message is AminoMsg<T1, T2> {
    return typeof message === 'object' && !!message && typeof message.type === 'string' && 'value' in message;
  }

  /** Amino is simply a normalized JSON format where object keys are sorted. This method implements that. */
  export function normalize<T>(value: T): T {
    return AminoMarshaller.marshal(value) as T;
  }
}

var defaultAminoTypes: Record<string, AminoType> = {};
export function registerDefaultAminos(...cls: AminoType[]) {
  for (const c of cls) {
    if (c.aminoTypeUrl in defaultAminoTypes) console.warn(`Default amino type ${c.aminoTypeUrl} already defined. Overriding.`);
    defaultAminoTypes[c.aminoTypeUrl] = c;
  }
}

mw.use({
  encoding: {
    encode: (network: NetworkConfig, encoding: string, value: any) => {
      if (encoding !== 'amino') return;
      const type = value?.aminoTypeUrl ?? value?.constructor?.aminoTypeUrl;
      if (!type) return;
      return {
        type,
        value: AminoMarshaller.marshal(value.data),
      };
    },
    decode: (network: NetworkConfig, encoding: string, value: any) => {
      if (encoding !== 'amino' || !Amino.isAmino(value)) return;
      const type = defaultAminoTypes[value.type];
      if (!type) return;
      return new type(AminoMarshaller.unmarshal(value.value));
    },
  },
});
