import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import { fromBase64, toBase64 } from '../utils.js';

/** An `Any` type in protobuf. It is generally a type URL with a binary payload. */
export type Any = {
  typeUrl: string;
  value: Uint8Array;
};

export function isAny(value: any): value is Any {
  if (typeof value !== 'object' || value === null) return false;
  if (typeof value.type_url !== 'string') return false;
  return value.type_url.startsWith('/') && value.value instanceof Uint8Array;
}

function isMarshalledAny(value: any): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (typeof value.type_url !== 'string' || typeof value.value !== 'string') return false;
  return value.type_url.startsWith('/');
}

/** A reusable un/marshalling unit that can be plugged into [marshal systems](https://github.com/kiruse/marshal.ts)
 * for automatic de/serialization. Note that you may need to combine this unit with a `RecaseMarshalUnit`.
 */
export const AnyMarshalUnit = defineMarshalUnit(
  (value: any) => isAny(value) ? morph({ type_url: value.typeUrl, value: toBase64(value.value) }) : pass,
  (value: any) => isMarshalledAny(value) ? morph({ type_url: value.type_url, value: fromBase64(value.value) }) : pass,
  true,
);

export const any = (typeUrl: string, value: Uint8Array): Any => ({ typeUrl: typeUrl, value });
