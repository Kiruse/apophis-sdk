/// <reference path="../../../node_modules/bun-types/index.d.ts" />
import { describe, expect, test } from 'bun:test';
import { LocalSigner } from './signer.js';
import { Asset, NetworkConfig } from '@apophis-sdk/core';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// const ADDR_ETH = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'; // can't test this currently due to lack of support in apophis-sdk
const ADDR_COSMOS = 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4';
const ADDR_NEUTRON = 'neutron19rl4cm2hmr8afy4kldpxz3fka4jguq0aclyl9j';
const ADDR_TERRA = 'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv';
const ADDR_INJ = 'inj1npvwllfr9dqr8erajqqr6s0vxnk2ak55re90dz';

const assets: Record<string, Asset> = {
  atom: {
    name: 'Atom',
    denom: 'uatom',
    decimals: 6,
  },
  luna: {
    name: 'Luna',
    denom: 'uluna',
    decimals: 6,
  },
  ntrn: {
    name: 'Neutron',
    denom: 'untrn',
    decimals: 6,
  },
  inj: {
    name: 'Injective',
    denom: 'inj',
    decimals: 18,
  },
}

const networks: Record<string, NetworkConfig> = {
  cosmoshub: {
    chainId: 'cosmoshub-4',
    name: 'cosmoshub',
    prettyName: 'Cosmos Hub',
    addressPrefix: 'cosmos',
    assets: [assets.atom],
    gas: [{
      asset: assets.atom,
      avgPrice: 0.0025,
    }],
  },
  neutron: {
    chainId: 'neutron-1',
    name: 'neutron',
    prettyName: 'Neutron',
    addressPrefix: 'neutron',
    assets: [assets.ntrn],
    gas: [{
      asset: assets.ntrn,
      avgPrice: 0.0053,
    }],
  },
  injective: {
    chainId: 'injective-1',
    name: 'injective',
    prettyName: 'Injective',
    addressPrefix: 'inj',
    slip44: 60,
    assets: [assets.inj],
    gas: [{
      asset: assets.inj,
      avgPrice: 500000000,
    }],
  },
  terra: {
    chainId: 'terra-1',
    name: 'terra',
    prettyName: 'Terra',
    addressPrefix: 'terra',
    slip44: 330,
    assets: [assets.luna],
    gas: [{
      asset: assets.luna,
      avgPrice: 0.015,
    }],
  },
}

describe('Local Signer', () => {
  test('mnemonic', async () => {
    const signer = await LocalSigner.fromMnemonic(MNEMONIC);
    await signer.connect(Object.values(networks));
    expect(signer.address(networks.cosmoshub)).toBe(ADDR_COSMOS);
    expect(signer.address(networks.neutron)).toBe(ADDR_NEUTRON);
    expect(signer.address(networks.terra)).toBe(ADDR_TERRA);
    expect(signer.address(networks.injective)).toBe(ADDR_INJ);
  });
});
