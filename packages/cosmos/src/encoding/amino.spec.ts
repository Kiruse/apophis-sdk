import { mw } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { network } from '@apophis-sdk/core/test-helpers.js';
import { fromHex, toBase64 } from '@apophis-sdk/core/utils.js';
import { describe, expect, test } from 'bun:test';
import { CosmosSecp256k1AminoType } from '../crypto/pubkey.js';
import { DefaultCosmosMiddlewares } from '../middleware.js';
import { Amino, registerDefaultAminos } from './amino';

mw.use(...DefaultCosmosMiddlewares);

class TestAmino {
  static readonly aminoTypeUrl = 'apophis-test/TestAmino';
  constructor(public data: string) {}
}

registerDefaultAminos(TestAmino);

describe('Amino', () => {
  test('normalize', () => {
    const ref = {
      c: 'hello',
      a: 456,
      b: 123,
    };
    const normalized = Amino.normalize(ref);
    expect(normalized).toEqual(ref);
    expect(JSON.stringify(normalized)).toEqual(`{"a":456,"b":123,"c":"hello"}`);
  });

  test('encode/decode', () => {
    const ref = new TestAmino('hello');
    const encoded = Amino.encode(network, ref);
    const decoded = Amino.decode(network, encoded);

    expect(encoded).toEqual({
      type: TestAmino.aminoTypeUrl,
      value: 'hello',
    });
    expect(JSON.stringify(encoded)).toEqual(`{"type":"apophis-test/TestAmino","value":"hello"}`);
    expect(decoded).toBeInstanceOf(TestAmino);
    expect(decoded).toEqual(ref);
  });

  test('encode/decode pubkeys', () => {
    const key = pubkey.secp256k1(fromHex('0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const encoded = Amino.encode(network, key);
    const decoded = Amino.decode(network, encoded);

    expect(encoded).toEqual({
      type: CosmosSecp256k1AminoType,
      value: typeof key.bytes === 'string' ? key.bytes : toBase64(key.bytes),
    });
    expect(decoded).toEqual({
      type: key.type,
      bytes: typeof key.bytes === 'string' ? key.bytes : toBase64(key.bytes),
    });
    expect(decoded).toBeInstanceOf(PublicKey);
  });
});
