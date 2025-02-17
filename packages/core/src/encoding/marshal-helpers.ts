import { defineMarshalUnit, morph, pass } from '@kiruse/marshal';
import { toBase64 } from '../utils.js';

/** Marshal unit for converting `Uint8Array` values to base64 strings. However, unmarshalling is
 * not supported as there is no absolutely reliable way to determine if a string is base64.
 */
export const B64MarshalUnit = defineMarshalUnit(
  (value: unknown) => value instanceof Uint8Array ? morph(toBase64(value)) : pass,
  () => pass,
);
