import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import { toBase64 } from './utils';

export const BytesMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof Uint8Array ? morph(toBase64(value)) : pass,
  () => pass, // base64 is too generic to reliably unmarshal
);
