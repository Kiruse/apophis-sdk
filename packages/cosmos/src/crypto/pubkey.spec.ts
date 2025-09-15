import { describe, expect, test } from 'bun:test';
import { Any } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { network } from '@apophis-sdk/core/test-helpers.js';
import { fromHex } from '@apophis-sdk/core/utils.js';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { CosmosEd25519TypeUrl, CosmosSecp256k1TypeUrl } from './pubkey.js';
import { addresses } from '@apophis-sdk/core';

// both secp256k1 & ed25519 pubkeys are 40 bytes + varint32 length prefix
// here, the prefix is 0x0A20, tho I'm not entirely sure why (20 from number of bytes, 0A from varint32 type??)
describe('PublicKey', () => {
  test('Encode/decode secp256k1', () => {
    const key = pubkey.secp256k1(fromHex('0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const any = Any.encode(network, key);
    expect(any).toEqual({ typeUrl: CosmosSecp256k1TypeUrl, value: fromHex('0x0A21000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20') });
    expect(Any.decode(network, any)).toEqual(key);
  });

  test('Encode/decode ed25519', () => {
    const key = pubkey.ed25519(fromHex('0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const any = Any.encode(network, key);
    expect(any).toEqual({ typeUrl: CosmosEd25519TypeUrl, value: fromHex('0x0A200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20') });
    expect(Any.decode(network, any)).toEqual(key);
  });

  test('Address of secp256k1 pubkey', () => {
    const key = pubkey.secp256k1(fromHex('0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'));
    const address = addresses.compute(network, key);
    expect(address).toEqual('neutron1cvd3mp7n2trlz77pufy59vzmm4xr8pl2phphv7');
  });
});
