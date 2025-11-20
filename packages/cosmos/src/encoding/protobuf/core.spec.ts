import { describe, expect, test } from 'bun:test';
import { Cosmos } from '../../api.js';
import { pbCoin } from './core.js';

describe('Protobuf Core', () => {
  test('Coin', () => {
    const ref = Cosmos.coin(1_000000n, 'foo');
    const decoded = pbCoin.decode(pbCoin.encode(ref).toShrunk().seek(0));
    expect(decoded).toMatchObject(ref);
  });
});
