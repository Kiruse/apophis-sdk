import { describe, expect, test } from 'bun:test';
import { NetworkConfig } from '../../types.js';
import { Any, registerDefaultProtobufs } from './any.js';
import { fromBase64, fromUtf8, toBase64, toUtf8 } from '../../utils.js';
import { mw } from '../../middleware.js';
import { network } from '../../test-helpers.js';
import { AnyMarshaller } from './marshaller.js';

class CustomProtobuf {
  static readonly protobufTypeUrl = '/test';

  constructor(public readonly bytes: Uint8Array) {}

  static toProtobuf(value: CustomProtobuf): Uint8Array {
    return value.bytes;
  }
  static fromProtobuf(value: Uint8Array): CustomProtobuf {
    return new CustomProtobuf(value);
  }
}

registerDefaultProtobufs(CustomProtobuf);

describe('Any', () => {
  test('Un/marshal', () => {
    const ref = Any('/test', fromUtf8('foobar'));
    const marshalled = AnyMarshaller.marshal(ref) as any;
    const unmarshalled = AnyMarshaller.unmarshal(marshalled) as any;
    expect(marshalled.typeUrl).toEqual('/test');
    expect(marshalled.value).toEqual(toBase64(fromUtf8('foobar')));
    expect(unmarshalled).toEqual(ref);
  });

  test('Any.encode/.decode default', () => {
    const ref = new CustomProtobuf(fromUtf8('foobar'));
    const marshalled = Any.encode(network, ref);
    const unmarshalled: any = Any.decode(network, marshalled);
    expect(marshalled.typeUrl).toEqual('/test');
    expect(toBase64(marshalled.value)).toEqual(toBase64(fromUtf8('foobar')));
    expect(unmarshalled).toEqual(ref);
  });

  test('Any.encode/.decode w/ middleware', () => {
    const unuse = mw.use({
      encoding: {
        encode(network: NetworkConfig, encoding: string, value: any) {
          if (encoding === 'protobuf' && value instanceof CustomProtobuf) {
            return Any('/test2', fromUtf8('custom:' + toBase64(value.bytes)));
          }
        },
        decode(network: NetworkConfig, encoding: string, value: any) {
          if (encoding !== 'protobuf') return;
          if (!Any.isAny(value, '/test2')) return;
          const valueStr = toUtf8(value.value);
          if (valueStr.startsWith('custom:')) {
            return new CustomProtobuf(fromBase64(valueStr.slice(7)));
          }
        },
      },
    });

    const ref = new CustomProtobuf(fromUtf8('foobar'));
    const marshalled = Any.encode(network, ref);
    const unmarshalled: any = Any.decode(network, marshalled);
    expect(marshalled.typeUrl).toEqual('/test2');
    expect(toUtf8(marshalled.value)).toEqual('custom:' + toBase64(fromUtf8('foobar')));
    expect(unmarshalled).toEqual(ref);

    unuse();
  });

  test('Any.isAny', () => {
    expect(Any.isAny({})).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: 'foobar' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: fromUtf8('foobar') })).toBeTrue();

    const ref = new CustomProtobuf(fromUtf8('foobar'));
    expect(Any.isAny(ref)).toBeFalse();
    expect(Any.isAny(Any.encode(network, ref))).toBeTrue();
  });
});
