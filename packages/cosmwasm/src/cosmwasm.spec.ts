import { describe, expect, test } from 'bun:test';
import { decodeKeypath, encodeKeypath } from './cosmwasm';
import { fromHex, toHex } from '@apophis-sdk/core/utils.js';

describe('CosmWasm', () => {
  test('encodeKeypath', () => {
    expect(toHex(encodeKeypath(['config']))).toEqual('636f6e666967');
    expect(toHex(encodeKeypath(['contract_info']))).toEqual('636f6e74726163745f696e666f');
    expect(toHex(encodeKeypath(['nft_stakes', 'migaloo123...', 'some_id']))).toEqual('000a6e66745f7374616b6573000d6d6967616c6f6f3132332e2e2e736f6d655f6964');
  });

  test('decodeKeypath', () => {
    expect(decodeKeypath(fromHex('636f6e666967'))).toEqual(['config']);
    expect(decodeKeypath(fromHex('636f6e74726163745f696e666f'))).toEqual(['contract_info']);
    expect(decodeKeypath(fromHex('000a6e66745f7374616b6573000d6d6967616c6f6f3132332e2e2e736f6d655f6964'))).toEqual(['nft_stakes', 'migaloo123...', 'some_id']);
  });
});
