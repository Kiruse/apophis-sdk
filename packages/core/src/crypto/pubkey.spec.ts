import { describe, expect, test } from 'bun:test';
import { fromHex } from '../utils.js';
import { pubkey } from './pubkey.js';
import { Any } from '../encoding/protobuf/any.js';
import { network } from 'src/test-helpers.js';

// both secp256k1 & ed25519 pubkeys are 40 bytes + varint32 length prefix
// here, the prefix is 0x0A20, tho I'm not entirely sure why (20 from number of bytes, 0A from varint32 type??)
describe('PublicKey', () => {
  test('Any.encode/.decode(Secp256k1PublicKey)', () => {
    const key = pubkey.secp256k1(fromHex('0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const any = Any.encode(network, key);
    expect(any).toEqual({ typeUrl: pubkey.secp256k1.typeUrl, value: fromHex('0x0A200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20') });
    expect(Any.decode(network, any)).toEqual(key);
  });

  test('Any.encode/.decode(Ed25519PublicKey)', () => {
    const key = pubkey.ed25519(fromHex('0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const any = Any.encode(network, key);
    expect(any).toEqual({ typeUrl: pubkey.ed25519.typeUrl, value: fromHex('0x0A200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20') });
    expect(Any.decode(network, any)).toEqual(key);
  });
});
