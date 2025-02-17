import { addresses } from '@apophis-sdk/core/address.js';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Any, MarshalledAny } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { type CosmosNetworkConfig } from '@apophis-sdk/core/networks.js';
import { Signer } from '@apophis-sdk/core/signer.js';
import { network } from '@apophis-sdk/core/test-helpers.js';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, test } from 'bun:test';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing.js';
import { Tx as SdkTx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { CosmosTx, CosmosTxAmino, CosmosTxDirect } from './tx.js';
import './crypto/pubkey.js'; // for pubkey & address middlewares
import { toBase64 } from '@apophis-sdk/core/utils.js';
import { Amino } from './encoding/amino.js';

class MockSigner extends Signer {
  readonly type = 'mock';
  readonly displayName = 'Mock';
  readonly logoURL = undefined;
  readonly canAutoReconnect = false;

  constructor(private readonly privateKey: Uint8Array) {
    super();
    this.available.value = true;
    this.signDatas.value = new Map([[network, [{
      publicKey: pubkey.secp256k1(secp256k1.getPublicKey(privateKey, true)),
      address: addresses.compute(network, pubkey.secp256k1(secp256k1.getPublicKey(privateKey, true))),
      accountNumber: 1n,
      sequence: 0n,
    }]]]);
  }

  async probe() {
    return true;
  }

  async connect() {}

  async sign(network: CosmosNetworkConfig, tx: CosmosTx) {
    const bytes = tx.signBytes(network, this);
    const signature = await secp256k1.signAsync(bytes, this.privateKey);
    tx.setSignature(network, this, signature.toCompactRawBytes());
    return tx;
  }

  broadcast(tx: CosmosTx): Promise<string> {
    throw new Error('Not implemented');
  }

  protected async getAccounts(network: CosmosNetworkConfig) {
    const publicKey = pubkey.secp256k1(secp256k1.getPublicKey(this.privateKey, true));
    return [{
      address: addresses.compute(network, publicKey),
      publicKey,
    }];
  }
}

describe('CosmosTx', () => {
  describe('CosmosTxDirect', () => {
    test('sdkTx', () => {
      const tx = new CosmosTxDirect();
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
              publicKey: Any.encode(network, signer.getSignData(network)[0].publicKey) as any,
              sequence: 0n,
            }
          ],
          fee: {},
        },
        signatures: [new Uint8Array()],
      }));
    });

    test('fullSdkTx fails', async () => {
      const tx = new CosmosTxDirect();
      expect(() => tx.fullSdkTx()).toThrow();
    });

    test('fullSdkTx', async () => {
      const tx = new CosmosTxDirect();
      const signer = new MockSigner(secp256k1.utils.randomPrivateKey());
      tx.gas = {
        amount: [{ denom: 'tntrn', amount: 1n }],
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
              publicKey: Any.encode(network, signer.getSignData(network)[0].publicKey) as any,
              sequence: 0n,
            }
          ],
          fee: {
            amount: [{ denom: 'tntrn', amount: '1' }],
            gasLimit: 200000n,
          },
        },
        signatures: [tx.signature!],
      }));
    });
  });

  describe('CosmosTxAmino', () => {
    test('sdkTx', () => {
      const tx = new CosmosTxAmino();
      const signer = new MockSigner(secp256k1.utils.randomPrivateKey());

      expect(tx.sdkTx(network, signer)).toEqual({
        msg: [],
        fee: {},
        memo: '',
        signatures: [],
      });
    });

    test('fullSdkTx fails', () => {
      const tx = new CosmosTxAmino();
      expect(() => tx.fullSdkTx()).toThrow();
    });

    test('fullSdkTx', async () => {
      const tx = new CosmosTxAmino();
      const signer = new MockSigner(secp256k1.utils.randomPrivateKey());
      tx.gas = {
        amount: [{ denom: 'tntrn', amount: 1n }],
        gasLimit: 200000n,
      };
      await signer.sign(network, tx);

      expect(tx.fullSdkTx()).toEqual({
        msg: [],
        fee: {
          amount: [{ denom: 'tntrn', amount: '1' }],
          gas_limit: "200000",
        },
        memo: '',
        signatures: [{
          pub_key: Amino.encode(network, signer.getSignData(network)[0].publicKey),
          signature: toBase64(tx.signature!),
        }],
      });
    });
  });
});
