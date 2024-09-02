import { defineMarshalUnit, extendMarshaller, morph, pass } from '@kiruse/marshal';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'bun:test';
import { bech32 } from 'bech32';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing.js';
import { SignDoc, Tx as SdkTx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Account, AccountData } from './account.js';
import { Cosmos } from './api.js';
import { pubkey } from './crypto/pubkey.js';
import { Any } from './encoding/protobuf/any.js';
import { Tx } from './tx.js';
import type { NetworkConfig, Loading } from './types.js';

const network: NetworkConfig = {
  chainId: 'neutron-1',
  prettyName: 'Neutron',
  name: 'neutron',
  feeDenoms: ['untrn'],
  gasPrice: 0.0055,
  addressPrefix: 'neutron',
};

const MsgSendMarshalUnit = defineMarshalUnit(
  (value: any) => {
    if (typeof value !== 'object') return pass;
    if ('amount' in value && 'fromAddress' in value && 'toAddress' in value)
      return morph(Any(MsgSend.typeUrl, MsgSend.encode(value).finish()));
    return pass;
  },
  (value: any) => {
    if (typeof value !== 'object') return pass;
    if (value.typeUrl === MsgSend.typeUrl)
      return morph(MsgSend.decode(value.value));
    return pass;
  },
);

// mock account should only be used for scaffolding testing, not for function testing
class MockAccount extends Account {
  constructor() {
    super(null as any);
  }

  sign(tx: Tx): Promise<Tx> {
    tx.setSignature(this, new Uint8Array());
    return Promise.resolve(tx);
  }

  protected async onNetworkChange(network: NetworkConfig, accountIndex: number): Promise<void> {
    this.signal.value = {
      loading: false,
      accountNumber: undefined,
      accountIndex,
      network,
      address: 'alice',
      publicKey: pubkey.secp256k1(new Uint8Array()),
      sequence: 0n,
    };
  }
}

describe('Tx', () => {
  test('sdkTx', async () => {
    const tx = new Tx();
    const account = new MockAccount();
    await account.bind(network);

    expect(tx.sdkTx(account)).toEqual(SdkTx.fromPartial({
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
                mode: SignMode.SIGN_MODE_UNSPECIFIED,
              },
            },
            publicKey: {
              typeUrl: '/cosmos.crypto.secp256k1.PubKey',
              value: new Uint8Array(),
            },
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
    const account = new MockAccount();
    await account.bind(network);
    expect(() => tx.fullSdkTx()).toThrow();
  });

  test('fullSdkTx', async () => {
    const tx = new Tx();
    const account = new MockAccount();
    await account.bind(network);
    tx.setSignature(account, new Uint8Array([1, 2, 3]))
    tx.gas = {
      amount: [Cosmos.coin(1, 'untrn')],
      gasLimit: 200000n,
    };

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
                mode: SignMode.SIGN_MODE_UNSPECIFIED,
              },
            },
            publicKey: {
              typeUrl: '/cosmos.crypto.secp256k1.PubKey',
              value: new Uint8Array(),
            },
            sequence: 0n,
          }
        ],
        fee: {
          amount: [Cosmos.coin(1, 'untrn')],
          gasLimit: 200000n,
        },
      },
      signatures: [new Uint8Array([1, 2, 3])],
    }));
  });
});

export class LocalAccount extends Account {
  readonly signal = signal<Loading<AccountData>>({ loading: true });
  #privateKey: Uint8Array;

  constructor(privateKey: Uint8Array) {
    super(null as any);
    this.#privateKey = privateKey;
  }

  async sign(tx: Tx): Promise<Tx> {
    const { network, accountIndex, publicKey, sequence } = this.signal.value;
    if (!network || accountIndex === undefined || !publicKey) throw new Error('Account not bound');

    const priv = this.#privateKey!;
    const bytes = SignDoc.encode(tx.signDoc(this)).finish();
    const hashed = sha256(bytes);
    const signature = await secp256k1.signAsync(hashed, priv);
    tx.setSignature(this, signature.toCompactRawBytes());
    return tx;
  }

  async onNetworkChange(network: NetworkConfig, accountIndex: number) {
    this.signal.value = { loading: true };
    if (!network.addressPrefix) throw new Error('Network address prefix is required');

    const pub = secp256k1.getPublicKey(this.#privateKey, true);
    const address = bech32.encode(network.addressPrefix, bech32.toWords(ripemd160(sha256(pub)).slice(0, 20)));

    const { accountNumber, sequence } = await Cosmos.getAccountInfo(this).catch(() => ({ accountNumber: undefined, sequence: 0n }));

    this.signal.value = {
      loading: false,
      network,
      address,
      sequence,
      publicKey: pubkey.secp256k1(pub),
      accountIndex,
      accountNumber,
    };
  }
}
