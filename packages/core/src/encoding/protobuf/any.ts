import { defineMarshalUnit, extendDefaultMarshaller, Marshaller, MarshalUnit, morph, pass } from '@kiruse/marshal';
import { isAnyable, isMarshalledAny } from '../../helpers.js';
import type { NetworkConfig } from '../../types.js';
import { fromBase64, toBase64 } from '../../utils.js';

/** Marshal unit for converting an `Any` type to the proper JSON variant & back for transmission. */
export const AnyMarshalUnit = defineMarshalUnit(
  (value: any) => Any.isAny(value) ? morph({ typeUrl: value.typeUrl, value: toBase64(value.value) }) : pass,
  (value: any) => isMarshalledAny(value) ? morph({ typeUrl: value.typeUrl, value: fromBase64(value.value) }) : pass,
);

/** An `Any` type in protobuf. It is generally a type URL with a binary payload. */
export type Any<T extends string = string> = {
  typeUrl: T;
  value: Uint8Array;
};

/** Base64 encoded variant of `Any`. */
export type MarshalledAny = {
  typeUrl: string;
  value: string;
};

/** Create a new `Any` type. This is a simple type with a `typeUrl` and a binary encoded protobuf `value`. */
export function Any(typeUrl: string, value: Uint8Array): Any {
  return { typeUrl, value };
}

/** The default marshal units to convert from & to the Protobuf `Any` type. You may add additional
 * units to this list to add new global marshal units.
 */
Any.defaultMarshalUnits = new Array<MarshalUnit>();
/** The default marshaller used when none is specified for a particular network. */
Any.defaultMarshaller = extendDefaultMarshaller(Any.defaultMarshalUnits);

/** Different marshallers for the Protobuf `Any` type, depending on the network. */
Any.marshallers = new class {
  #map = new Map<NetworkConfig, Marshaller>();

  get(network: NetworkConfig): Marshaller {
    return this.#map.get(network) ?? Any.defaultMarshaller;
  }

  set(network: NetworkConfig, marshaller: Marshaller) {
    this.#map.set(network, marshaller);
    return this;
  }

  delete(network: NetworkConfig) {
    return this.#map.delete(network);
  }

  has(network: NetworkConfig) {
    return this.#map.has(network);
  }

  keys() {
    return this.#map.keys();
  }

  values() {
    return this.#map.values();
  }

  entries() {
    return this.#map.entries();
  }
}

/** Check if a value is a proper `Any` type. */
Any.isAny = (value: any): value is Any => {
  if (typeof value !== 'object' || value === null) return false;
  if (typeof value.typeUrl !== 'string') return false;
  return value.typeUrl.startsWith('/') && value.value instanceof Uint8Array;
}

/** Convert any compatible value to a `Any` type. */
Any.encode = (network: NetworkConfig, value: any): Any => {
  if (isMarshalledAny(value)) return value;
  const tmp = Any.marshallers.get(network).marshal(value);
  if (Any.isAny(tmp)) return tmp;
  throw new Error('Invalid value for Any.encode');
}

/** Convert any compatible value from an `Any` type. */
Any.decode = (network: NetworkConfig, value: Any): unknown => {
  if (isMarshalledAny(value)) return Any.marshallers.get(network)!.unmarshal(value);
  if (isAnyable(value)) return value;
  throw new Error('Invalid value for Any.decode');
}
