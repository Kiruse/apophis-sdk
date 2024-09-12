import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import { PubKey as Sdk_Secp256k1PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { PubKey as Sdk_Ed25519PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { AnyTypeUrlSymbol } from '../constants';
import { Any } from '../encoding/protobuf/any';
import { fromAnyable, isAnyable, isMarshalledAny, toAnyable } from '../helpers';
import { fromBase64 } from '../utils';

export type PublicKey = Secp256k1PublicKey | Ed25519PublicKey;

const SECP256K1_TYPE_URL = '/cosmos.crypto.secp256k1.PubKey' as const;
const ED25519_TYPE_URL = '/cosmos.crypto.ed25519.PubKey' as const;

export type Secp256k1PublicKey = {
  [AnyTypeUrlSymbol]: typeof pubkey.secp256k1.typeUrl;
  key: Uint8Array;
}

export type Ed25519PublicKey = {
  [AnyTypeUrlSymbol]: typeof pubkey.ed25519.typeUrl;
  key: Uint8Array;
}

export const pubkey = new class {
  secp256k1 = Object.assign(
    (key: Uint8Array): Secp256k1PublicKey => ({ [AnyTypeUrlSymbol]: SECP256K1_TYPE_URL, key }),
    { typeUrl: SECP256K1_TYPE_URL }
  );
  ed25519 = Object.assign(
    (key: Uint8Array): Ed25519PublicKey => ({ [AnyTypeUrlSymbol]: ED25519_TYPE_URL, key }),
    { typeUrl: ED25519_TYPE_URL }
  );
  isSecp256k1(pubkey: PublicKey): pubkey is Secp256k1PublicKey {
    return pubkey[AnyTypeUrlSymbol] === SECP256K1_TYPE_URL;
  };
  isEd25519(pubkey: PublicKey): pubkey is Ed25519PublicKey {
    return pubkey[AnyTypeUrlSymbol] === ED25519_TYPE_URL;
  };
};

/** Marshal unit for converting an `Secp256k1PublicKey` to its Protobuf `Any` equivalent. */
export const Secp256k1PublicKeyMarshalUnit = defineMarshalUnit(
  (value: any) => isAnyable(value, pubkey.secp256k1.typeUrl)
    ? morph(fromAnyable(value, Sdk_Secp256k1PubKey.encode(Sdk_Secp256k1PubKey.fromPartial({ key: value.key })).finish()))
    : pass,
  (value: any) => isMarshalledAny(value, pubkey.secp256k1.typeUrl)
    ? morph(toAnyable(value, {
        key: Sdk_Secp256k1PubKey.decode(typeof value.value === 'string' ? fromBase64(value.value) : value.value).key,
      }) satisfies Secp256k1PublicKey)
    : pass,
);

/** Marshal unit for converting an `Ed25519PublicKey` to its Protobuf `Any` equivalent. */
export const Ed25519PublicKeyMarshalUnit = defineMarshalUnit(
  (value: any) => isAnyable(value, pubkey.ed25519.typeUrl)
    ? morph(fromAnyable(value, Sdk_Ed25519PubKey.encode(Sdk_Ed25519PubKey.fromPartial({ key: value.key })).finish()))
    : pass,
  (value: any) => isMarshalledAny(value, pubkey.ed25519.typeUrl)
    ? morph(toAnyable(value, {
        key: Sdk_Ed25519PubKey.decode(typeof value.value === 'string' ? fromBase64(value.value) : value.value).key,
      }) satisfies Ed25519PublicKey)
    : pass,
);

Any.defaultMarshalUnits.push(
  Secp256k1PublicKeyMarshalUnit,
  Ed25519PublicKeyMarshalUnit,
);
