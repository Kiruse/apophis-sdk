import { defineMarshalUnit, extendDefaultMarshaller, extendMarshaller, IgnoreMarshalUnit, MarshalUnit, morph, pass } from '@kiruse/marshal';
import { Any } from './any.js';
import { fromBase64, toBase64 } from '../../utils.js';

/** Marshal unit for converting an `Any` type to the proper JSON variant & back for transmission.
 *
 * **Note** that this is expressly not intended to be a part of the serialization process within
 * the protobuf serialization itself. It should be applied only for transmission.
 */
export const AnyMarshalUnit = defineMarshalUnit(
  (value: any) => Any.isAny(value)
    ? morph({
        typeUrl: value.typeUrl,
        value: typeof value.value === 'string' ? value.value : toBase64(value.value),
      })
    : pass,
  (value: any) => Any.isMarshalled(value)
    ? morph({
        typeUrl: value.typeUrl,
        value: fromBase64(value.value),
      })
    : pass,
);

export const defaultAnyMarshalUnits: MarshalUnit[] = [
  IgnoreMarshalUnit(Uint8Array),
];

/** The standard marshaller to encode values to their protobuf `Any` representation. */
export const AnyMarshaller = extendDefaultMarshaller(defaultAnyMarshalUnits);

/** The standard marshaller to encode values to their protobuf binary representations.
 * This differs from the `AnyMarshaller` in that it strips the `typeUrl` from the encoded value.
 * Generally, you will only want to use the `AnyMarshaller` unless you are implementing a custom
 * type.
 */
export const ProtobufMarshaller = extendMarshaller(AnyMarshaller, [
  {
    marshal: (value: any) => {
      if (Any.isAny(value)) return morph(value.value);
      if (Any.isMarshalled(value)) return morph(fromBase64(value.value));
      return pass;
    },
    unmarshal: () => pass,
    generic: true, // generic causes this to be applied after specialized marshallers from the AnyMarshaller
  },
]);
