import { Any, config, type NetworkConfig, type Signer, TxBase, TxStatus } from '@apophis-sdk/core';
import type { Gas } from '@apophis-sdk/core/types.sdk.js';
import { Decimal } from '@kiruse/decimal';
import { sha256 } from '@noble/hashes/sha256';
import { AuthInfo, Tx as SdkTx, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Cosmos } from './api';

/** The format of a Cosmos transaction. Of the two formats, `protobuf` is the default, and `amino`
 * is deprecated. Not all messages support the `amino` format as it has painful limitations. When
 * possible, use `protobuf`. However, the Ledger hardware wallet only supports `amino`, which
 * unfortunately means that not all transactions can be signed with a Ledger device.
 */
export type CosmosTxFormat = 'protobuf' | 'amino';

export interface TxOptions extends Partial<Omit<TxBody, 'messages'>> {
  gas?: Gas;
}

/** A transaction builder which accumulates data throughout the various steps of the transaction life cycle. */
export class CosmosTx implements TxBase {
  readonly ecosystem = 'cosmos';
  /** This is currently just a placeholder for near-future implementation. In the future, changing
   * this format value will automatically change the signing flow accordingly.
   */
  format: CosmosTxFormat = 'protobuf';
  extensionOptions: Any[] = [];
  nonCriticalExtensionOptions: Any[] = [];
  memo = '';
  /** Typically, timeout height of 0 is synonymous with "no timeout". */
  timeoutHeight = 0n;
  #status: TxStatus = 'unsigned';
  #signer: Signer | undefined;
  #signature: Uint8Array | undefined;
  #network: NetworkConfig | undefined;
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

  setSignature(network: NetworkConfig, signer: Signer<any>, signature: Uint8Array): this {
    this.#signer = signer;
    this.#signature = signature;
    this.#network = network;
    return this;
  }

  setGas(gas: Gas): this {
    this.gas = gas;
    return this;
  }

  computeGas(network: NetworkConfig, size: bigint | number, populate?: boolean): Gas {
    const [cfg] = network.gas;
    const gas = Decimal.parse(size);
    const amount = gas.mul(Decimal.parse(cfg.lowPrice ?? cfg.avgPrice)).rebase(0).valueOf() + 1n;
    const result = {
      amount: [Cosmos.coin(amount, cfg.asset.denom)],
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
  simulate(network: NetworkConfig, signer: Signer) {
    return Cosmos.rest(network).cosmos.tx.v1beta1.simulate('POST', {
      tx_bytes: SdkTx.encode(this.sdkTx(network, signer)).finish(),
    });
  }

  async estimateGas(network: NetworkConfig, signer: Signer, populate?: boolean): Promise<Gas> {
    const { gas_info } = await this.simulate(network, signer);
    if (!gas_info) throw new Error('Failed to simulate transaction');
    const units = Decimal.parse(gas_info.gas_used).mul(Decimal.parse(network.gasFactor ?? config.gasFactor)).rebase(0);
    return this.computeGas(network, units.valueOf(), populate);
  }

  /** Convenience method to broadcast this transaction to the network. Calls the signer's `broadcast` method. */
  broadcast() {
    if (!this.#signer) throw new Error('Signer not bound');
    return this.#signer.broadcast(this);
  }

  /** The SignDoc is the 2nd step in the transaction process:
   *
   * 1. `.estimateGas` (optional)
   * 2. `.signDoc` to request a signature from the user
   * 3. `.setSignature` to finalize the transaction document
   * 4. `.broadcast` to send the transaction to the network
   */
  signDoc(network: NetworkConfig, signer: Signer): SignDoc {
    if (!this.gas) throw new Error('Gas not set');
    const sdktx = this.sdkTx(network, signer);
    return SignDoc.fromPartial({
      bodyBytes: TxBody.encode(sdktx.body!).finish(),
      authInfoBytes: AuthInfo.encode(sdktx.authInfo!).finish(),
      chainId: network.chainId,
      accountNumber: signer.getSignData(network)[0].accountNumber,
    });
  }

  /** Get a partial Cosmos SDK Tx object. This does not require gas or signature, in which case it can be used for simulation (including gas estimation). */
  sdkTx(network: NetworkConfig, signer: Signer, signature = new Uint8Array()): SdkTx {
    const { publicKey, sequence } = signer.getSignData(network)[0];
    if (!network || !publicKey) throw new Error('Account not bound');
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
    if (!this.#signer || !this.#signature || !this.#network) throw new Error('Signature not bound');
    return this.sdkTx(this.#network, this.#signer, this.#signature);
  }

  signBytes(network: NetworkConfig, signer: Signer): Uint8Array {
    return sha256(SignDoc.encode(this.signDoc(network, signer)).finish());
  }

  bytes(): Uint8Array {
    return SdkTx.encode(this.fullSdkTx()).finish();
  }

  get status(): TxStatus { return this.#status }
  get signer() { return this.#signer }
  get network() { return this.#network }
  get signature(): Uint8Array | undefined { return this.#signature }
  get hash() { return this.#hash ?? Cosmos.getTxHash(this.fullSdkTx()) }
  get error() { return this.#error }
}
