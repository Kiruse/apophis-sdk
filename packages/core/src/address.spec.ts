import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, test } from 'bun:test';
import { addresses, MemoryAddressBook } from './address';
import { MiddlewarePipelineError, mw } from './middleware';
import { network } from './test-helpers';
import { pubkey } from './crypto/pubkey';

mw.use({}); // used to test fifo - missing middleware methods and/or undefined result should be ignored
mw.use(MemoryAddressBook);

describe('addresses', () => {
  test('alias', () => {
    const alice = Math.random().toString(36).slice(2);
    const bob = Math.random().toString(36).slice(2);

    expect(() => addresses.alias(alice)).toThrowError(MiddlewarePipelineError);
    expect(() => addresses.alias(bob)).toThrowError(MiddlewarePipelineError);

    MemoryAddressBook.record(alice, 'alice');
    MemoryAddressBook.record(bob, 'bob');

    expect(addresses.alias(alice)).toBe('alice');
    expect(addresses.alias(bob)).toBe('bob');
  });

  test('resolve', () => {
    const alice = Math.random().toString(36).slice(2);
    const bob = Math.random().toString(36).slice(2);

    expect(() => addresses.resolve(alice)).toThrowError(MiddlewarePipelineError);
    expect(() => addresses.resolve(bob)).toThrowError(MiddlewarePipelineError);

    MemoryAddressBook.record(alice, 'alice');
    MemoryAddressBook.record(bob, 'bob');

    expect(addresses.resolve('alice')).toBe(alice);
    expect(addresses.resolve('bob')).toBe(bob);
  });

  test('compute', () => {
    const alicePriv = secp256k1.utils.randomPrivateKey();
    const alicePub = pubkey.secp256k1(secp256k1.getPublicKey(alicePriv));
    const bobPriv = secp256k1.utils.randomPrivateKey();
    const bobPub = pubkey.secp256k1(secp256k1.getPublicKey(bobPriv));

    expect(() => addresses.compute(network, alicePub.key)).not.toThrowError(MiddlewarePipelineError);
    expect(() => addresses.compute(network, bobPub.key)).not.toThrowError(MiddlewarePipelineError);
  });
});
