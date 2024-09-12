import { describe, expect, test } from 'bun:test';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx.js';
import { Any, AnyMarshalUnit } from './any.js';
import { createMarshaller, defineMarshalUnit, extendMarshaller, morph, pass } from '@kiruse/marshal';
import { fromUtf8, toBase64, toUtf8 } from '../../utils.js';
import { AnyTypeUrlSymbol } from '../../constants.js';
import { fromAnyable, isAnyable, isMarshalledAny, toAnyable } from '../../helpers.js';
import { network } from 'src/test-helpers.js';

describe('Any', () => {
  test('Un/marshal', () => {
    const { marshal, unmarshal } = createMarshaller([AnyMarshalUnit]);

    const ref = Any('/test', fromUtf8('foobar'));
    const marshalled = marshal(ref) as any;
    const unmarshalled = unmarshal(marshalled) as any;
    expect(marshalled.typeUrl).toEqual('/test');
    expect(marshalled.value).toEqual(toBase64(fromUtf8('foobar')));
    expect(unmarshalled).toEqual(ref);
  });

  test('To/from Any', () => {
    const ref1 = {
      [AnyTypeUrlSymbol]: '/test1',
      id: 123n,
      text: 'foobar',
    };

    const ref2 = {
      [AnyTypeUrlSymbol]: '/test2',
      foo: 'bar',
      baz: 42,
    };

    expect(isAnyable(ref1)).toBeTrue();
    expect(isAnyable(ref2)).toBeTrue();

    const unit1 = defineMarshalUnit(
      (value: any) => isAnyable(value, '/test1') ? morph(fromAnyable(value, fromUtf8(`${value.id}:${value.text}`))) : pass,
      (value: any) => {
        if (isMarshalledAny(value, '/test1')) {
          const [id, text] = toUtf8(value.value).split(':');
          return morph(toAnyable(value, { id: BigInt(id), text }));
        }
        return pass;
      },
    );

    const unit2 = defineMarshalUnit(
      (value: any) => isAnyable(value, '/test2') ? morph(fromAnyable(value, fromUtf8(`${value.foo}:${value.baz}`))) : pass,
      (value: any) => {
        if (isMarshalledAny(value, '/test2')) {
          const [foo, baz] = toUtf8(value.value).split(':');
          return morph(toAnyable(value, { foo, baz: Number(baz) }));
        }
        return pass;
      },
    );

    const { marshal, unmarshal } = createMarshaller([unit1, unit2]);

    const marshalled1 = marshal(ref1) as any;
    const unmarshalled1 = unmarshal(marshalled1) as any;
    expect(marshalled1).toEqual({ typeUrl: '/test1', value: fromUtf8(`123:foobar`) });
    expect(unmarshalled1).toEqual(ref1);

    const marshalled2 = marshal(ref2) as any;
    const unmarshalled2 = unmarshal(marshalled2) as any;
    expect(marshalled2).toEqual({ typeUrl: '/test2', value: fromUtf8(`bar:42`) });
    expect(unmarshalled2).toEqual(ref2);
  });

  test('Any.encode/.decode', () => {
    const { encode, decode } = Any;

    const ref = {
      [AnyTypeUrlSymbol]: '/test',
      id: 123n,
      text: 'foobar',
    };

    const unit = defineMarshalUnit(
      (value: any) => isAnyable(value, '/test') ? morph(fromAnyable(value, fromUtf8(`${value.id}:${value.text}`))) : pass,
      (value: any) => {
        if (isMarshalledAny(value, '/test')) {
          const [id, text] = toUtf8(value.value).split(':');
          return morph(toAnyable(value, { id: BigInt(id), text }));
        }
        return pass;
      },
    );

    Any.marshallers.set(network, createMarshaller([unit]));

    const encoded = encode(network, ref);
    const decoded = decode(network, encoded);

    expect(decoded).toEqual(ref);
    expect(encoded).toEqual({ typeUrl: '/test', value: fromUtf8(`123:foobar`) });
  });

  test('Any.isAny', () => {
    expect(Any.isAny({})).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: 'foobar' })).toBeFalse();
    expect(Any.isAny({ typeUrl: '/test', value: fromUtf8('foobar') })).toBeTrue();

    const msg = MsgSend.fromPartial({
      amount: [{ denom: 'foo', amount: '100' }],
      fromAddress: 'neutron123',
      toAddress: 'neutron456',
    });

    const MsgSendMarshalUnit = defineMarshalUnit(
      (value: any) => {
        if (typeof value !== 'object') return pass;
        if ('amount' in value && 'fromAddress' in value && 'toAddress' in value)
          return morph(Any(MsgSend.typeUrl, MsgSend.encode(value).finish()));
        return pass;
      },
      (value: any) => {
        if (typeof value !== 'object') return pass;
        if (value.typeUrl === MsgSend.typeUrl)
          return morph(MsgSend.decode(value.value));
        return pass;
      },
    );

    const network: any = {};
    Any.marshallers.set(network, extendMarshaller(Any.defaultMarshaller, [MsgSendMarshalUnit]));
    expect(Any.isAny(msg)).toBeFalse();
    expect(Any.isAny(Any.encode(network, msg))).toBeTrue();
  });
});
