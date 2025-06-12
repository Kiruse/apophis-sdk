import { Apophis } from '@apophis-sdk/core';
import { Any } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { network } from '@apophis-sdk/core/test-helpers.js';
import { toBase64 } from '@apophis-sdk/core/utils.js';
import { Amino } from '@apophis-sdk/cosmos/encoding/amino.js';
import { describe, expect, test } from 'bun:test';
import { DefaultCosmWasmMiddlewares } from '../middleware.js';
import { Contract } from './contracts.js';

Apophis.use(...DefaultCosmWasmMiddlewares);

describe('CosmWasm Contracts', () => {
  describe('StoreCode', () => {
    test('Amino', () => {
      const wasmByteCode = new Uint8Array([1, 2, 3, 4]);
      const msg = new Contract.StoreCode({
        sender: 'cosmos1...',
        wasmByteCode,
      });

      const marshalled = Amino.encode(network, msg);
      expect(marshalled).toEqual({
        type: 'wasm/MsgStoreCode',
        value: {
          sender: 'cosmos1...',
          wasm_byte_code: toBase64(wasmByteCode),
        },
      });

      const unmarshalled = Amino.decode(network, marshalled) as Contract.StoreCode;
      expect(unmarshalled).toBeInstanceOf(Contract.StoreCode);
      expect(unmarshalled.data).toMatchObject({
        sender: 'cosmos1...',
        wasmByteCode,
      });
    });

    test('Protobuf', () => {
      const wasmByteCode = new Uint8Array([1, 2, 3, 4]);
      const msg = new Contract.StoreCode({
        sender: 'cosmos1...',
        wasmByteCode,
      });

      const marshalled = Any.encode(network, msg);
      expect(marshalled.typeUrl).toBe('/cosmwasm.wasm.v1.MsgStoreCode');
      expect(marshalled.value).toBeInstanceOf(Uint8Array);

      const unmarshalled = Any.decode(network, marshalled) as Contract.StoreCode;
      expect(unmarshalled).toBeInstanceOf(Contract.StoreCode);
      expect(unmarshalled.data).toMatchObject({
        sender: 'cosmos1...',
        wasmByteCode,
      });
    });
  });

  describe('Instantiate', () => {
    test('Amino', () => {
      const msg = new Contract.Instantiate({
        admin: 'cosmos1...',
        sender: 'cosmos1...',
        codeId: 1n,
        label: 'test-contract',
        msg: { init: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });

      const marshalled = Amino.encode(network, msg);
      expect(marshalled).toEqual({
        type: 'wasm/MsgInstantiateContract',
        value: {
          admin: 'cosmos1...',
          sender: 'cosmos1...',
          code_id: '1',
          label: 'test-contract',
          msg: { init: 'data' },
          funds: [{ denom: 'uatom', amount: '1000000' }],
        },
      });

      const unmarshalled = Amino.decode(network, marshalled) as Contract.Instantiate;
      expect(unmarshalled).toBeInstanceOf(Contract.Instantiate);
      expect(unmarshalled.data).toMatchObject({
        admin: 'cosmos1...',
        sender: 'cosmos1...',
        codeId: 1n,
        label: 'test-contract',
        msg: { init: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });
    });

    test('Protobuf', () => {
      const msg = new Contract.Instantiate({
        admin: 'cosmos1...',
        sender: 'cosmos1...',
        codeId: 1n,
        label: 'test-contract',
        msg: { init: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });

      const marshalled = Any.encode(network, msg);
      expect(marshalled.typeUrl).toBe('/cosmwasm.wasm.v1.MsgInstantiateContract');
      expect(marshalled.value).toBeInstanceOf(Uint8Array);

      const unmarshalled = Any.decode(network, marshalled) as Contract.Instantiate;
      expect(unmarshalled).toBeInstanceOf(Contract.Instantiate);
      expect(unmarshalled.data).toMatchObject({
        admin: 'cosmos1...',
        sender: 'cosmos1...',
        codeId: 1n,
        label: 'test-contract',
        msg: { init: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });
    });
  });

  describe('Execute', () => {
    test('Amino', () => {
      const msg = new Contract.Execute({
        sender: 'cosmos1...',
        contract: 'cosmos1...',
        msg: [{ execute: 'data' }],
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });

      const marshalled = Amino.encode(network, msg);
      expect(marshalled).toEqual({
        type: 'wasm/MsgExecuteContract',
        value: {
          sender: 'cosmos1...',
          contract: 'cosmos1...',
          msg: [{ execute: 'data' }],
          funds: [{ denom: 'uatom', amount: '1000000' }],
        },
      });

      const unmarshalled = Amino.decode(network, marshalled) as Contract.Execute;
      expect(unmarshalled).toBeInstanceOf(Contract.Execute);
      expect(unmarshalled.data).toMatchObject({
        sender: 'cosmos1...',
        contract: 'cosmos1...',
        msg: [{ execute: 'data' }],
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });
    });

    test('Protobuf', () => {
      const msg = new Contract.Execute({
        sender: 'cosmos1...',
        contract: 'cosmos1...',
        msg: { execute: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });

      const marshalled = Any.encode(network, msg);
      expect(marshalled.typeUrl).toBe('/cosmwasm.wasm.v1.MsgExecuteContract');
      expect(marshalled.value).toBeInstanceOf(Uint8Array);

      const unmarshalled = Any.decode(network, marshalled) as Contract.Execute;
      expect(unmarshalled).toBeInstanceOf(Contract.Execute);
      expect(unmarshalled.data).toMatchObject({
        sender: 'cosmos1...',
        contract: 'cosmos1...',
        msg: { execute: 'data' },
        funds: [{ denom: 'uatom', amount: 1000000n }],
      });
    });
  });
});
