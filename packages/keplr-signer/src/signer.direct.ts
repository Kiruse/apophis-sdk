import { Account, Any, Cosmos, type NetworkConfig } from '@apophis-sdk/core';
import { Tx } from '@apophis-sdk/core/tx.js';
import { pubkey } from '@apophis-sdk/core/crypto/pubkey.js';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import Long from 'long';
import { KeplrSignerBase } from './signer.base';
import { fromBase64, toHex } from '@apophis-sdk/core/utils.js';
import { TendermintQuery } from '@apophis-sdk/core/query.js';

const accounts: WeakRef<KeplrDirectAccount>[] = [];

/** Keplr Direct Signer.
 *
 * In Cosmos, there are currently two data formats for transactions: Amino and Protobuf aka Direct.
 * Amino is the legacy format and is being phased out in favor of Protobuf. It is still highly
 * relevant as the Cosmos Ledger Micro-App currently only supports Amino. It is also the reason why
 * many modern Dapps leveraging modern Cosmos SDK modules which do not support Amino are incompatible
 * with Ledger.
 *
 * When detecting, you need to check only one of `await KeplrDirect.probe()` or `await KeplrAmino.probe()`
 * as they abstract the same interface.
 */
export const KeplrDirect = new class extends KeplrSignerBase {
  readonly type = 'Keplr.Direct';

  account(): Account {
    return new KeplrDirectAccount();
  }
}

export class KeplrDirectAccount extends Account {
  constructor() {
    super(KeplrDirect);
    accounts.push(new WeakRef(this));
  }

  protected async onNetworkChange(network: NetworkConfig, accountIndex: number) {
    this.signal.value = { loading: true };

    const { address, pubkey: key, algo } = await getAddressAndPubkey(network, accountIndex);
    const publicKey = algo === 'secp256k1'
      ? pubkey.secp256k1(key)
      : algo === 'ed25519'
        ? pubkey.ed25519(key)
        : undefined;
    if (!publicKey) throw new Error('Unsupported public key algorithm');

    // network & address needed by `Cosmos.getAccountInfo()`
    this.signal.value = { loading: true, network, address };
    const { accountNumber, sequence } = await Cosmos.getAccountInfo(network, address)
      .catch(() => ({ accountNumber: undefined, sequence: 0n }));
    if (accountNumber === undefined) console.warn('Account not registered on-chain');

    this.signal.value = {
      loading: false,
      accountNumber,
      network,
      address,
      accountIndex,
      publicKey,
      sequence,
    };
  }

  async sign(tx: Tx) {
    const { address, network, publicKey, sequence = 0n } = this;
    if (!window.keplr) throw new Error('Keplr not available');
    if (!address || !publicKey || !network) throw new Error('Account not bound to a network');

    const signer = await window.keplr.getOfflineSigner(network.chainId);
    const signDoc = tx.signDoc(this);
    const keplrSignDoc = {
      ...signDoc,
      accountNumber: Long.fromValue(signDoc.accountNumber.toString()),
    };

    const {
      signed,
      signature: { signature },
    } = await signer.signDirect(address, keplrSignDoc);

    const body = TxBody.decode(signed.bodyBytes);
    tx.memo = body.memo;
    tx.extensionOptions = body.extensionOptions;
    tx.nonCriticalExtensionOptions = body.nonCriticalExtensionOptions;
    tx.timeoutHeight = body.timeoutHeight;

    const authInfo = AuthInfo.decode(signed.authInfoBytes);
    tx.gas = {
      amount: authInfo.fee!.amount,
      gasLimit: authInfo.fee!.gasLimit,
      granter: authInfo.fee!.granter,
      payer: authInfo.fee!.payer,
    };

    tx.setSignature(this, fromBase64(signature));

    return tx;
  }
}

async function getAddressAndPubkey(network: NetworkConfig, accountIndex: number | bigint) {
  if (!window.keplr) throw new Error('Keplr not available');
  const offlineSigner = await window.keplr.getOfflineSigner(network.chainId);
  const accounts = await offlineSigner.getAccounts();
  if (!accounts[Number(accountIndex)]) throw new Error('Account not found');
  return accounts[Number(accountIndex)];
}

if (globalThis.window) {
  window.addEventListener('keplr_keystorechange', () => {
    for (const account of accounts) {
      const ref = account.deref();
      if (ref?.network) {
        ref.bind(ref.network, ref.accountIndex);
      }
    }
    purgeAccounts();
  });
}

// TODO: this really needs to be smarter but I'm about to change a lot about accounts anyways
setInterval(() => {
  accounts.forEach(async account => {
    const ref = account.deref();
    if (ref?.network) {
      const { sequence } = await Cosmos.getAccountInfo(ref.network, ref.address!);
      ref.signal.value.sequence = sequence;
    }
    purgeAccounts();
  })
}, 5000);

function purgeAccounts() {
  let idx = accounts.findIndex((account) => !account.deref());
  while (idx !== -1) {
    accounts.splice(idx, 1);
    idx = accounts.findIndex((account) => !account.deref());
  }
}
