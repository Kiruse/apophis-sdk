import { Signal } from '@preact/signals-core';
import { PubKey as SdkEd25519PublicKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { PubKey as SdkSecp256k1PublicKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { pubkey, PublicKey } from './crypto/pubkey';
import { type Anylike } from './encoding/protobuf/any';

export function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromHex(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  if (!hex.match(/^[0-9a-fA-F]+$/)) throw new Error('Invalid hex string');
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  return new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
}

export function toHex(bytes: Uint8Array): string {
  return bytes.reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '');
}

export function fromUtf8(utf8: string): Uint8Array {
  return new TextEncoder().encode(utf8);
}

export function toUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export const getFirstSignal = <T>(signals: (Signal<T | undefined | null> | undefined | null)[]): T | undefined =>
  signals.find(signal => signal?.value)?.value ?? undefined;

export function fromSdkPublicKey(publicKey: Anylike): PublicKey {
  let { typeUrl, value } = publicKey;
  if (typeof value === 'string') value = fromBase64(value);

  switch (typeUrl) {
    case SdkEd25519PublicKey.typeUrl: {
      const key = SdkEd25519PublicKey.decode(value);
      return pubkey.ed25519(key.key);
    }
    case SdkSecp256k1PublicKey.typeUrl: {
      const key = SdkSecp256k1PublicKey.decode(value);
      return pubkey.secp256k1(key.key);
    }
    default:
      throw new Error('Unsupported pubkey type');
  }
}
