import { Decimal } from '@kiruse/decimal';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { AuthInfo, Tx as SdkTx, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Account } from './account.js';
import { Cosmos } from './api.js';
import { config } from './constants.js';
import { Any } from './encoding/protobuf/any.js';
import type { Gas } from './types.sdk.js';
import { NetworkConfig } from './types.js';

export type TxStatus = 'unsigned' | 'signed' | 'confirmed' | 'failed';

export interface TxOptions extends Partial<Omit<TxBody, 'messages'>> {
  gas?: Gas;
}

/** A transaction builder which accumulates data throughout the various steps of the transaction life cycle. */
export class Tx {
  extensionOptions: Any[] = [];
  nonCriticalExtensionOptions: Any[] = [];
  memo = '';
  /** Typically, timeout height of 0 is synonymous with "no timeout". */
  timeoutHeight = 0n;
  #status: TxStatus = 'unsigned';
  #account: Account | undefined;
  #signature: Uint8Array | undefined;
  #hash: string | undefined;
  #error: string | undefined;
  gas: Gas | undefined;

  constructor(public messages: Any[] = [], opts?: TxOptions) {
    this.gas = opts?.gas;
    this.extensionOptions = opts?.extensionOptions ?? [];
    this.nonCriticalExtensionOptions = opts?.nonCriticalExtensionOptions ?? [];
    this.memo = opts?.memo ?? '';
    this.timeoutHeight = opts?.timeoutHeight ?? 0n;
  }

  setSignature(account: Account, signature: Uint8Array): this {
    this.#account = account;
    this.#signature = signature;
    return this;
  }

  setGas(gas: Gas): this {
    this.gas = gas;
    return this;
  }

  computeGas(network: NetworkConfig, size: bigint | number, populate?: boolean): Gas {
    const data = getGasData(network);
    const gas = Decimal.parse(size);
    const amount = gas.mul(data.price).rebase(0).valueOf() + 1n;
    const result = {
      amount: [Cosmos.coin(amount, data.denoms[0])],
      gasLimit: gas.valueOf(),
    } satisfies Gas;
    if (populate) this.gas = result;
    return result;
  }

  confirm(hash: string) {
    this.#status = 'confirmed';
    this.#hash = hash;
  }

  reject(hash: string, error: string) {
    this.#status = 'failed';
    this.#hash = hash;
    this.#error = error;
  }

  /** Non-interface method to simulate this transaction. `estimateGas` extracts the `gas_info` from this method's result. */
  simulate(account: Account) {
    if (!account.network) throw new Error('Account not bound');
    return Cosmos.rest(account.network).cosmos.tx.v1beta1.simulate('POST', {
      tx_bytes: SdkTx.encode(this.sdkTx(account)).finish(),
    });
  }

  async estimateGas(account: Account, populate?: boolean): Promise<Gas> {
    if (!account.network) throw new Error('Account not bound');
    const { gas_info } = await this.simulate(account);
    if (!gas_info) throw new Error('Failed to simulate transaction');
    const units = Decimal.parse(gas_info.gas_used).mul(getGasData(account.network).multiplier).rebase(0);
    return this.computeGas(account.network, units.valueOf(), populate);
  }

  /** Convenience method to broadcast this transaction to the network. Calls the signer's `broadcast` method. */
  broadcast() {
    if (!this.#account) throw new Error('Account not bound');
    return this.#account.signer.broadcast(this);
  }

  /** The SignDoc is the 2nd step in the transaction process:
   *
   * 1. `.estimateGas` (optional)
   * 2. `.signDoc` to request a signature from the user
   * 3. `.setSignature` to finalize the transaction document
   * 4. `.broadcast` to send the transaction to the network
   */
  signDoc(account: Account): SignDoc {
    if (!account.network) throw new Error('Account not bound');
    if (!this.gas) throw new Error('Gas not set');
    const sdktx = this.sdkTx(account);
    return SignDoc.fromPartial({
      bodyBytes: TxBody.encode(sdktx.body!).finish(),
      authInfoBytes: AuthInfo.encode(sdktx.authInfo!).finish(),
      chainId: account.network.chainId,
      accountNumber: account.accountNumber,
    });
  }

  /** Get a partial Cosmos SDK Tx object. This does not require gas or signature, in which case it can be used for simulation (including gas estimation). */
  sdkTx(account: Account, signature = new Uint8Array()): SdkTx {
    const { network, publicKey, sequence = 0n } = account;
    if (!network || !publicKey || sequence === undefined) throw new Error('Account not bound');
    return SdkTx.fromPartial({
      body: {
        messages: this.messages.map(msg => Any.encode(network, msg)),
        extensionOptions: this.extensionOptions,
        nonCriticalExtensionOptions: this.nonCriticalExtensionOptions,
        memo: this.memo,
        timeoutHeight: this.timeoutHeight,
      },
      authInfo: {
        signerInfos: [{
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_DIRECT,
            },
          },
          publicKey: Any.encode(network, publicKey),
          sequence,
        }],
        fee: this.gas ?? {},
      },
      signatures: [signature],
    });
  }

  fullSdkTx(): SdkTx {
    if (!this.gas) throw new Error('Gas not set');
    if (!this.#account) throw new Error('Account not bound');
    if (!this.#signature) throw new Error('Signature not set');
    return this.sdkTx(this.#account, this.#signature);
  }

  bytes(): Uint8Array {
    return SdkTx.encode(this.fullSdkTx()).finish();
  }

  get status(): TxStatus { return this.#status }
  get account() { return this.#account }
  get network() { return this.#account?.network }
  get signature(): Uint8Array | undefined { return this.#signature }
  get hash() { return this.#hash ?? Cosmos.getTxHash(this.fullSdkTx()) }
  get error() { return this.#error }
}

const getGasData = (network: NetworkConfig) => ({
  price: typeof network.gasPrice === 'number' ? Decimal.parse(network.gasPrice) : network.gasPrice,
  denoms: network.feeDenoms,
  multiplier: Decimal.parse(config.gasMultiplier ?? 1.2),
});
