import { mw } from '../../middleware.js';
import type { Bytes, NetworkConfig } from '../../types.js';
import { fromBase64 } from '../../utils.js';

// TODO: implement protobuf wire format: https://protobuf.dev/programming-guides/encoding/

export type Anylike = Any | MarshalledAny;

/** An `Any` type in protobuf. It is generally a type URL with a binary payload. */
export type Any<T extends string = string> = {
  typeUrl: T;
  value: Bytes;
};

/** Base64 encoded variant of `Any`. */
export type MarshalledAny<T extends string = string> = {
  typeUrl: T;
  value: string;
};

/** Create a new `Any` type. This is a simple type with a `typeUrl` and a binary encoded protobuf `value`. */
export function Any(typeUrl: string, value: Uint8Array): Any {
  return { typeUrl, value };
}

export type ProtobufType<T1 extends string = string, T2 = any> = {
  get protobufTypeUrl(): T1;
  toProtobuf(value: T2): Uint8Array;
  fromProtobuf(value: Uint8Array): T2;
}

/** Check if a value is a proper `Any` type. */
Any.isAny = (value: any, typeUrl?: string): value is Any => {
  if (typeof value !== 'object' || value === null) return false;
  if (typeUrl === undefined ? typeof value.typeUrl !== 'string' : value.typeUrl !== typeUrl) return false;
  return value.typeUrl.startsWith('/') && value.value instanceof Uint8Array;
}

/** Check if a value is a proper marshalled `Any` type (value is a b64 string of the bytes). */
Any.isMarshalled = (value: any, typeUrl?: string): value is MarshalledAny => {
  if (typeof value !== 'object' || value === null) return false;
  if (typeUrl === undefined ? typeof value.typeUrl !== 'string' : value.typeUrl !== typeUrl) return false;
  return value.typeUrl.startsWith('/') && typeof value.value === 'string';
}

/** Encode any compatible value to an `Any` type. Network dependent.
 *
 * **Note:** This function delegates to the `encoding` middleware, thus you may specialize its
 * implementation for a network by adding a custom middleware.
 */
Any.encode = (network: NetworkConfig, value: any): Any => {
  if (Any.isAny(value)) return value;
  if (Any.isMarshalled(value)) {
    return {
      typeUrl: value.typeUrl,
      value: fromBase64(value.value),
    };
  }

  const result = mw('encoding', 'encode').inv().fifo(network, 'protobuf', value);
  if (!Any.isAny(result)) throw new Error('Invalid value for Any.encode');
  return result;
}

/** Decode an `Any` type to its original value. Network dependent.
 *
 * **Note:** This function delegates to the `encoding` middleware, thus you may specialize its
 * implementation for a network by adding a custom middleware.
 */
Any.decode = (network: NetworkConfig, value: Any): unknown => {
  if (Any.isMarshalled(value)) {
    value = {
      typeUrl: value.typeUrl,
      value: fromBase64(value.value),
    };
  }
  if (!Any.isAny(value)) throw new Error('Invalid value for Any.decode');
  return mw('encoding', 'decode').inv().fifo(network, 'protobuf', value);
}

var defaultProtobufTypes: Record<string, ProtobufType> = {};
export function registerDefaultProtobufs(...types: ProtobufType[]) {
  for (const type of types) {
    if (type.protobufTypeUrl in defaultProtobufTypes) console.warn(`Default protobuf type ${type.protobufTypeUrl} already defined. Overriding.`);
    defaultProtobufTypes[type.protobufTypeUrl] = type;
  }
}

mw.use({
  encoding: {
    encode: (network: NetworkConfig, encoding: string, value: any) => {
      if (encoding !== 'protobuf' || typeof value !== 'object') return;
      const type = defaultProtobufTypes[value?.protobufTypeUrl ?? value?.constructor?.protobufTypeUrl];
      if (!type) return;
      return {
        typeUrl: type.protobufTypeUrl,
        value: type.toProtobuf(value),
      };
    },
    decode: (network: NetworkConfig, encoding: string, value: unknown) => {
      if (encoding !== 'protobuf') return;
      if (Any.isMarshalled(value)) {
        value = {
          typeUrl: value.typeUrl,
          value: fromBase64(value.value),
        };
      }
      if (!Any.isAny(value)) return;
      const type = defaultProtobufTypes[value.typeUrl];
      if (!type) return;
      return type.fromProtobuf(typeof value.value === 'string' ? fromBase64(value.value) : value.value);
    },
  },
});
