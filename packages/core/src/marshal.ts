import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import { toBase64 } from './utils';

// import these for side effects of adding default marshal units to Any
import './crypto/pubkey.js';
import './msg/bank.js';
import './msg/cosmwasm.js';

export const BytesMarshalUnit = defineMarshalUnit(
  (value: any) => value instanceof Uint8Array ? morph(toBase64(value)) : pass,
  () => pass, // base64 is too generic to reliably unmarshal
);
