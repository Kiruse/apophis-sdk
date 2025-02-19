import { mw } from '@apophis-sdk/core';
import { addresses } from '@apophis-sdk/core/address.js';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Any } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { type CosmosNetworkConfig } from '@apophis-sdk/core/networks.js';
import { Signer } from '@apophis-sdk/core/signer.js';
import { network } from '@apophis-sdk/core/test-helpers.js';
import { fromHex, toBase64, toHex } from '@apophis-sdk/core/utils.js';
import * as secp256k1 from '@noble/secp256k1';
import { describe, expect, test } from 'bun:test';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing.js';
import { Tx as SdkTx, Tx } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Amino } from './encoding/amino.js';
import { DefaultCosmosMiddlewares } from './middleware.js';
import { CosmosTx, CosmosTxAmino, CosmosTxDirect } from './tx.js';
import { Bank } from './msg/bank.js';
import { Cosmos } from './index.js';

mw.use(...DefaultCosmosMiddlewares);

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

const TEST_PRIVKEY = fromHex('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');

const MSG = new Bank.Send({
  fromAddress: 'neutron123',
  toAddress: 'neutron456',
  amount: [Cosmos.coin(1000000n, 'untrn')],
});

// Serialized bytes of a known correct tx. Or, well, at least we know it works on Neutron Testnet.
// This version of the library was used to produce the following tx (which is not this tx):
// https://www.mintscan.io/neutron-testnet/tx/03A7C58ECEA384FD4810817CA92CEB092102F66062752ABF60DC9F34D3178EFE
// Essentially, we use this as a sort of snapshot to ensure future changes to the library don't break this.
const REF_PB_BYTES = fromHex('0a4c0a4a0a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e64122a0a0a6e657574726f6e313233120a6e657574726f6e3435361a100a05756e74726e12073130303030303012620a4e0a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a2102c6b754b20826eb925e052ee2c25285b162b51fdca732bcf67e39d647fb6830ae12040a02080112100a0a0a05746e74726e12013110c09a0c1a40d308a0472d8ba6b41a017fdcc962b1d6da9b72fe55ae4820e69c743d49afbdc447768c2f5e0aeb04ecd10c2b3d799b3f159a9c9fb55f5f43de91b68a0c7db7b6');

// Same for Amino:
// https://www.mintscan.io/neutron-testnet/tx/D0C77CB3DDDA16AAF0D337C61D72472B6DBDECAED1387054093F56A4EB784F6A
const REF_AMINO_BYTES = fromHex('0a4c0a4a0a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e64122a0a0a6e657574726f6e313233120a6e657574726f6e3435361a100a05756e74726e12073130303030303012620a4e0a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a2102c6b754b20826eb925e052ee2c25285b162b51fdca732bcf67e39d647fb6830ae12040a02087f12100a0a0a05746e74726e12013110c09a0c1a4028fdda7ec1fedabff66457e074b2092082555cc059d75c4b1e2670b194dfea8815eb9e26587a81905d243715b5f00749d98dc0f473163a593797c91a7e65c22c');

// TODO: add signing tests w/ concrete cases
// unfortunately, the cosmjs suite also doesn't have concrete cases. they only test if the signature
// verifies. but w/o a concrete test case, it is impossible to know if the signature we produce is
// correct, and signature verification is dependent on the actual message. thus, without a concrete
// test case, we cannot assert that the message itself is correctly formed, and thus would be
// accepted by the chain.
describe('CosmosTx', () => {
  describe('CosmosTxDirect', () => {
    test('sdkTx', () => {
      const tx = new CosmosTxDirect([MSG]);
      const signer = new MockSigner(TEST_PRIVKEY);

      expect(tx.sdkTx(network, signer)).toEqual(SdkTx.fromPartial({
        body: {
          messages: [Any.encode(network, MSG) as any],
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
      const tx = new CosmosTxDirect([MSG]);
      expect(() => tx.fullSdkTx()).toThrow();
    });

    test('fullSdkTx', async () => {
      const tx = new CosmosTxDirect([MSG]);
      const signer = new MockSigner(TEST_PRIVKEY);
      tx.gas = {
        amount: [{ denom: 'tntrn', amount: 1n }],
        gasLimit: 200000n,
      };
      await signer.sign(network, tx);

      expect(tx.fullSdkTx()).toEqual(SdkTx.fromPartial({
        body: {
          messages: [Any.encode(network, MSG) as any],
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
      expect(tx.bytes()).toEqual(REF_PB_BYTES);
    });
  });

  describe('CosmosTxAmino', () => {
    test('sdkTx', () => {
      const tx = new CosmosTxAmino([MSG]);
      const signer = new MockSigner(TEST_PRIVKEY);

      expect(tx.sdkTx(network, signer)).toEqual(SdkTx.fromPartial({
        body: {
          messages: [Any.encode(network, MSG) as any],
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
                  mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
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

    test('fullSdkTx fails', () => {
      const tx = new CosmosTxAmino([MSG]);
      expect(() => tx.fullSdkTx()).toThrow();
    });

    test('fullSdkTx', async () => {
      const tx = new CosmosTxAmino([MSG]);
      const signer = new MockSigner(TEST_PRIVKEY);
      tx.gas = {
        amount: [{ denom: 'tntrn', amount: 1n }],
        gasLimit: 200000n,
      };
      await signer.sign(network, tx);

      expect(tx.fullSdkTx()).toEqual(SdkTx.fromPartial({
        body: {
          messages: [Any.encode(network, MSG) as any],
          extensionOptions: [],
          nonCriticalExtensionOptions: [],
        },
        authInfo: {
          signerInfos: [
            {
              modeInfo: {
                single: {
                  mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
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
      expect(tx.bytes()).toEqual(REF_AMINO_BYTES);
    });
  });
});
