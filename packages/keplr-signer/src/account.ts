import { DirectSignerPayload, NetworkConfig } from '@crypto-me/core';
import { Account } from '@crypto-me/core/account.js';
import { Cosmos } from '@crypto-me/core/api/index.js';
import { AuthInfo, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import Long from 'long';
import * as Protobuf from '@crypto-me/core/encoding/protobuf.js';
import type Tx from '@crypto-me/core/tx.js';
import { fromBase64 } from '@crypto-me/core/utils.js';

const accounts: WeakRef<KeplrDirectAccount>[] = [];

export class KeplrDirectAccount extends Account<Tx<DirectSignerPayload>> {
  /** The account number of this account in the global chain state. Undefined when the account hasn't been seen in a transaction yet. */
  #accountNumber: bigint | undefined;

  constructor() {
    super();
    accounts.push(new WeakRef(this));
  }

  protected async onNetworkChange(network: NetworkConfig, accountIndex: number) {
    this.signal.value = { loading: true };

    const { address, publicKey } = await getAddressAndPubkey(network, accountIndex);

    // network & address needed by `Cosmos.getAccountInfo()`
    this.signal.value = { loading: true, network, address };
    const { accountNumber, sequence } = await Cosmos.getAccountInfo(this)
      .catch(() => ({ accountNumber: undefined, sequence: 0n }));

    this.#accountNumber = accountNumber;
    this.signal.value = {
      loading: false,
      network,
      address,
      accountIndex,
      publicKey,
      sequence,
    };
  }

  async sign(tx: Tx<DirectSignerPayload>) {
    const { address, network, publicKey, sequence = 0n } = this;
    const { payload } = tx;
    if (!window.keplr) throw new Error('Keplr not available');
    if (!address || !publicKey || !network) throw new Error('Account not bound to a network');
    if (!payload) throw new Error('Transaction payload not set');

    const signer = await window.keplr.getOfflineSigner(network.chainId);

    const {
      signed,
      signature: { signature },
    } = await signer.signDirect(address, {
      //@ts-ignore honestly no idea if we can just ignore this. docs are inconclusive lol
      accountNumber: this.#accountNumber ? Long.fromString(this.#accountNumber + '') : undefined,
      chainId: network.chainId,
      authInfoBytes: AuthInfo.encode(AuthInfo.fromPartial({
        signerInfos: [{
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_DIRECT,
            },
          },
          publicKey: Protobuf.any('/cosmos.crypto.secp256k1.PubKey', publicKey),
          sequence,
        }],
      })).finish(),
      bodyBytes: TxBody.encode(tx.payload!).finish(),
    });

    const txraw = TxRaw.fromPartial({
      signatures: [fromBase64(signature)],
      authInfoBytes: signed.authInfoBytes,
      bodyBytes: signed.bodyBytes,
    });
    tx.signed(this, TxRaw.encode(txraw).finish());
    return tx;
  }
}

async function getAddressAndPubkey(network: NetworkConfig, accountIndex: number | bigint) {
  if (!window.keplr) throw new Error('Keplr not available');
  const offlineSigner = await window.keplr.getOfflineSigner(network.chainId);
  const accounts = await offlineSigner.getAccounts();
  if (!accounts[Number(accountIndex)]) throw new Error('Account not found');
  const { address, pubkey } = accounts[Number(accountIndex)];
  return { address, publicKey: pubkey };
}

if (globalThis.window) {
  window.addEventListener('keplr_keystorechange', () => {
    for (const account of accounts) {
      const ref = account.deref();
      if (ref?.network) {
        ref.bind(ref.network, ref.accountIndex);
      }
    }
    let idx = accounts.findIndex((account) => !account.deref());
    while (idx !== -1) {
      accounts.splice(idx, 1);
      idx = accounts.findIndex((account) => !account.deref());
    }
  });
}
