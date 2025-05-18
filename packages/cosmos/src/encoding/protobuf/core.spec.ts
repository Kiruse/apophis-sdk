import { describe, test, expect } from 'bun:test';
import { Cosmos } from 'src/api';
import { pbCoin } from './core';

describe('Protobuf Core', () => {
  test('Coin', () => {
    const ref = Cosmos.coin(1_000000n, 'foo');
    const decoded = pbCoin.decode(pbCoin.encode(ref).toShrunk().seek(0));
    expect(decoded).toMatchObject(ref);
  });
});
