import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { Signal, signal } from '@preact/signals-core';
import { describe, expect, test } from 'bun:test';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing.js';
import { Tx as SdkTx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Cosmos } from './api.js';
import { pubkey } from './crypto/pubkey.js';
import { Tx } from './tx.js';
import type { NetworkConfig, Signer, SignData } from './types.js';
import { getAddress } from './utils.js';
import { type Asset } from './networks.js';
import { Any } from './encoding/protobuf/any.js';

const asset: Asset = {
  denom: 'tntrn',
  name: 'Test Neutron',
};

const network: NetworkConfig = {
  chainId: 'neutron-1',
  prettyName: 'Neutron',
  name: 'neutron',
  assets: [asset],
  gas: [{
    asset,
    avgPrice: 0.0053,
  }],
  addressPrefix: 'neutron',
};

class MockSigner implements Signer {
  readonly type = 'mock';
  readonly available = signal(true);
  readonly signData = signal<SignData | undefined>();
  readonly displayName = 'Mock';
  readonly logoURL = undefined;
  #sequence = 0n;

  constructor(private readonly privateKey: Uint8Array) {
    this.signData.value = {
      publicKey: pubkey.secp256k1(secp256k1.getPublicKey(privateKey, true)),
      address: getAddress(network.addressPrefix, secp256k1.getPublicKey(privateKey, true)),
      accountNumber: 1n,
      sequence: 0n,
    };
  }

  async probe() {
    return true;
  }

  async connect() {}

  async sign(network: NetworkConfig, tx: Tx) {
    const bytes = sha256(tx.signBytes(network, this));
    const signature = await secp256k1.signAsync(bytes, this.privateKey);
    tx.setSignature(network, this, signature.toCompactRawBytes());
    return tx;
  }

  broadcast(tx: Tx): Promise<string> {
    throw new Error('Not implemented');
  }

  addresses(networks?: NetworkConfig[]): string[] {
    return networks?.map(network => this.address(network)) ?? [];
  }

  address(network: NetworkConfig): string {
    return getAddress(network.addressPrefix, secp256k1.getPublicKey(this.privateKey, true));
  }

  getSignData(network: NetworkConfig): SignData {
    const pub = secp256k1.getPublicKey(this.privateKey, true);
    const address = getAddress(network.addressPrefix, pub);

    return {
      accountNumber: 1n,
      sequence: this.#sequence,
      publicKey: pubkey.secp256k1(pub),
      address,
    };
  }
}

describe('Tx', () => {
  test('sdkTx', async () => {
    const tx = new Tx();
    const signer = new MockSigner(secp256k1.utils.randomPrivateKey());

    expect(tx.sdkTx(network, signer)).toEqual(SdkTx.fromPartial({
      body: {
        messages: [],
        extensionOptions: [],
        nonCriticalExtensionOptions: [],
        memo: '',
        timeoutHeight: 0n,
      },
      authInfo: {
        signerInfos: [
          {
            modeInfo: {
              single: {
                mode: SignMode.SIGN_MODE_DIRECT,
              },
            },
            publicKey: Any.encode(network, signer.getSignData(network).publicKey),
            sequence: 0n,
          }
        ],
        fee: {},
      },
      signatures: [new Uint8Array()],
    }));
  });

  test('fullSdkTx fails', async () => {
    const tx = new Tx();
    expect(() => tx.fullSdkTx()).toThrow();
  });

  test('fullSdkTx', async () => {
    const tx = new Tx();
    const signer = new MockSigner(secp256k1.utils.randomPrivateKey());
    tx.gas = {
      amount: [Cosmos.coin(1, 'tntrn')],
      gasLimit: 200000n,
    };
    await signer.sign(network, tx);

    expect(tx.fullSdkTx()).toEqual(SdkTx.fromPartial({
      body: {
        messages: [],
        extensionOptions: [],
        nonCriticalExtensionOptions: [],
        memo: '',
        timeoutHeight: 0n,
      },
      authInfo: {
        signerInfos: [
          {
            modeInfo: {
              single: {
                mode: SignMode.SIGN_MODE_DIRECT,
              },
            },
            publicKey: Any.encode(network, signer.getSignData(network).publicKey),
            sequence: 0n,
          }
        ],
        fee: {
          amount: [Cosmos.coin(1, 'tntrn')],
          gasLimit: 200000n,
        },
      },
      signatures: [tx.signature!],
    }));
  });
});
