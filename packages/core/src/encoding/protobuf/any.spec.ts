import { describe, expect, test } from 'bun:test';
import { mw } from '../../middleware.js';
import { network } from '../../test-helpers.js';
import { Bytes, NetworkConfig } from '../../types.js';
import { fromUtf8, toBase64, toUtf8 } from '../../utils.js';
import { Any, ProtobufMiddleware, registerDefaultProtobufSchema } from './any.js';
import { AnyMarshaller } from './marshaller.js';
import { hpb } from '@kiruse/hiproto';
import { Bytes as HiprotoBytes, ProtoBuffer } from '@kiruse/hiproto/protobuffer';

mw.use(ProtobufMiddleware);

const coinSchema = hpb.message({
  denom: hpb.string(1),
  amount: hpb.string(2).transform<bigint>({
    encode: (value) => value.toString(),
    decode: (value) => BigInt(value),
    default: 0n,
  }),
});

const customProtobufSchema = hpb.message({
  flag: hpb.bool(1),
  name: hpb.string(2),
  amount: hpb.submessage(3, coinSchema),
});

class CustomProtobuf {
  static readonly protobufTypeUrl = '/test';
  static readonly protobufSchema = customProtobufSchema;

  constructor(public data: hpb.infer<typeof customProtobufSchema>) {}
};

registerDefaultProtobufSchema(CustomProtobuf);

describe('Any', () => {
  test('Un/marshal', () => {
    const ref = Any('/test', fromUtf8('foobar'));
    const marshalled = AnyMarshaller.marshal(ref) as any;
    const unmarshalled = AnyMarshaller.unmarshal(marshalled) as any;
    expect(marshalled.typeUrl).toEqual('/test');
    expect(marshalled.value).toEqual(fromUtf8('foobar'));
    expect(unmarshalled).toEqual(ref);
  });

  test('Any.encode/.decode default', () => {
    const ref = new CustomProtobuf({
      flag: true,
      name: 'foobar',
      amount: {
        denom: 'foo',
        amount: 1_000000n
      },
    });
    const marshalled = Any.encode(network, ref);
    const unmarshalled: any = Any.decode(network, marshalled);
    expect(marshalled.typeUrl).toEqual('/test');
    expect(b64(marshalled.value)).toEqual('CAESBmZvb2JhchoOCgNmb28SBzEwMDAwMDA=');
    expect(unmarshalled).toMatchObject(ref);
  });

  test('Any.encode/.decode w/ middleware', () => {
    const unuse = mw.use({
      encoding: {
        encode(network: NetworkConfig, encoding: string, value: any) {
          if (encoding === 'protobuf' && value instanceof CustomProtobuf) {
            const encoded = CustomProtobuf.protobufSchema.encode(value.data).toShrunk();
            return Any('/test2', fromUtf8('hex:' + encoded.toHex()));
          }
        },
        decode(network: NetworkConfig, encoding: string, value: any) {
          if (encoding !== 'protobuf') return;
          if (!Any.isAny(value, '/test2')) return;

          const valueStr = utf8(value.value);
          if (valueStr.startsWith('hex:')) {
            const hex = valueStr.slice(4);
            const bytes = HiprotoBytes.fromHex(hex);
            return new CustomProtobuf(CustomProtobuf.protobufSchema.decode(new ProtoBuffer(bytes)));
          }
        },
      },
    });

    const ref = new CustomProtobuf({
      flag: true,
      name: 'foobar',
      amount: {
        denom: 'foo',
        amount: 1_000000n
      },
    });
    const marshalled = Any.encode(network, ref);
    const unmarshalled: any = Any.decode(network, marshalled);
    expect(marshalled.typeUrl).toEqual('/test2');
    expect(utf8(marshalled.value)).toEqual('hex:08011206666f6f6261721a0e0a03666f6f120731303030303030');
    expect(unmarshalled).toMatchObject(ref);

    unuse();
  });

  test('Any.isAny', () => {
    expect(Any.isAny({})).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: 'foobar' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: fromUtf8('foobar') })).toBeTrue();

    const ref = new CustomProtobuf({
      flag: true,
      name: 'foobar',
      amount: {
        denom: 'foo',
        amount: 1_000000n
      },
    });
    expect(Any.isAny(ref)).toBeFalse();
    expect(Any.isAny(Any.encode(network, ref))).toBeTrue();
  });
});

const b64 = (value: Bytes) => typeof value === 'string' ? value : toBase64(value);
const utf8 = (value: Bytes) => typeof value === 'string' ? value : toUtf8(value);
