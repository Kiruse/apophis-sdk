import { AuthInfo, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import type { Account } from './account.js';
import * as Protobuf from './encoding/protobuf.js'
import { DirectSignerPayload } from './types.js';

export type TxStatus = 'unsigned' | 'signed' | 'confirmed' | 'failed';

/** Represents a signed message. */
export interface SignedMessage {
  get status(): TxStatus;
  /** The hash of this transaction, if `status` is `confirmed`. A `failed` transaction may also have a hash, typically when a smart contract errored. */
  get hash(): string | undefined;
  broadcast(): Promise<string>;
}

export default class Tx<Payload> {
  #status: TxStatus = 'unsigned';
  #account: Account<Tx<Payload>> | undefined;
  #bytes: Uint8Array | undefined;
  #hash: string | undefined;
  #promise = new Promise<string>((resolve, reject) => {
    this.#resolve = resolve;
    this.#reject = reject;
  });
  #resolve: (value: string) => void = () => {};
  #reject: (reason: any) => void = () => {};

  constructor(
    public payload: Payload | undefined,
  ) {}

  signed(account: Account<Tx<Payload>>, bytes: Uint8Array) {
    this.#status = 'signed';
    this.#account = account;
    this.#bytes = bytes;
    return this;
  }

  confirm(hash: string) {
    if (this.#status !== 'signed') throw new Error('Transaction is not pending');
    this.#hash = hash;
    this.#status = 'confirmed';
    this.#resolve(hash);
    return this;
  }

  reject(hash: string, reason: any) {
    if (this.#status !== 'signed') throw new Error('Transaction is not pending');
    this.#hash = hash;
    this.#status = 'failed';
    this.#reject(reason);
    return this;
  }

  /** Retrieve a promise to await the completion of this transaction. Take care to call the
   * `.broadcast()` method beforehand. Alternatively, you may also simply `await` the `.broadcast()`
   * method.
   */
  sync() { return this.#promise }

  get status() { return this.#status }
  get hash() { return this.#hash }
  get account() { return this.#account }
  get network() { return this.account?.network }
  get bytes() { return this.#bytes }
}

/** A helper method for Cosmos Direct Signing wallets. */
export function getSignDoc(
  account: Account<Tx<DirectSignerPayload>>,
  tx: Tx<DirectSignerPayload>,
  accountNumber?: bigint, // honestly not sure if this can be optional
): SignDoc {
  const { network, publicKey, sequence = 0n } = account.signal.value;
  if (!network || !publicKey) throw new Error('Account not bound to a network');
  if (!tx.payload) throw new Error('No body bound to this transaction');

  return SignDoc.fromPartial({
    accountNumber: accountNumber,
    chainId: network.chainId,
    authInfoBytes: AuthInfo.encode(AuthInfo.fromPartial({
      signerInfos: [
        {
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_DIRECT,
            },
          },
          publicKey: Protobuf.any('/cosmos.crypto.secp256k1.PubKey', publicKey),
          sequence: sequence,
        }
      ]
    })).finish(),
    bodyBytes: TxBody.encode(tx.payload).finish(),
  });
}
