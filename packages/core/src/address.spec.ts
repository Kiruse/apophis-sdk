import { describe, expect, test } from 'bun:test';
import { addresses, MemoryAddressBook } from './address';
import { mw } from './middleware';

mw.use(MemoryAddressBook);

describe('addresses', () => {
  test('alias', () => {
    const alice = Math.random().toString(36).slice(2);
    const bob = Math.random().toString(36).slice(2);

    expect(addresses.alias(alice)).toBeUndefined();
    expect(addresses.alias(bob)).toBeUndefined();

    MemoryAddressBook.record(alice, 'alice');
    MemoryAddressBook.record(bob, 'bob');

    expect(addresses.alias(alice)).toBe('alice');
    expect(addresses.alias(bob)).toBe('bob');
  });

  test('resolve', () => {
    const alice = Math.random().toString(36).slice(2);
    const bob = Math.random().toString(36).slice(2);

    expect(addresses.resolve(alice)).toBeUndefined();
    expect(addresses.resolve(bob)).toBeUndefined();

    MemoryAddressBook.record(alice, 'alice');
    MemoryAddressBook.record(bob, 'bob');

    expect(addresses.resolve('alice')).toBe(alice);
    expect(addresses.resolve('bob')).toBe(bob);
  });
});
