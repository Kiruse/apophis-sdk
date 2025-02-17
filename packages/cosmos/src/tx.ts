import { Any, config, type CosmosNetworkConfig, type Signer, TxBase, TxStatus } from '@apophis-sdk/core';
import type { Gas } from '@apophis-sdk/core/types.sdk.js';
import { Decimal } from '@kiruse/decimal';
import { sha256 } from '@noble/hashes/sha256';
import { AuthInfo, Tx as SdkTxDirect, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Cosmos } from './api';
import { fromBase64, fromUtf8, toHex } from '@apophis-sdk/core/utils.js';
import { mw } from '@apophis-sdk/core/middleware.js';

/** The format of a Cosmos transaction. Of the two formats, `protobuf` is the default, and `amino`
 * is deprecated. Not all messages support the `amino` format as it has painful limitations. When
 * possible, use `protobuf`. However, the Ledger hardware wallet only supports `amino`, which
 * unfortunately means that not all transactions can be signed with a Ledger device.
 */
export type CosmosTxEncoding = 'protobuf' | 'amino';

export interface DirectTxOptions extends Partial<Omit<TxBody, 'messages'>> {
  gas?: Gas;
}

export interface AminoTxOptions {
  gas?: Gas;
  memo?: string;
}

export type CosmosTx = CosmosTxDirect | CosmosTxAmino;

/** A transaction builder which accumulates data throughout the various steps of the transaction life cycle. */
export class CosmosTxDirect implements TxBase {
  readonly ecosystem = 'cosmos';
  readonly encoding = 'protobuf';
  extensionOptions: Any[] = [];
  nonCriticalExtensionOptions: Any[] = [];
  memo = '';
  /** Typically, timeout height of 0 is synonymous with "no timeout". */
  timeoutHeight = 0n;
  #status: TxStatus = 'unsigned';
  #signer: Signer | undefined;
  #signature: Uint8Array | undefined;
  #network: CosmosNetworkConfig | undefined;
  #hash: string | undefined;
  #error: string | undefined;
  gas: Gas | undefined;

  constructor(public messages: Any[] = [], opts?: DirectTxOptions) {
    this.gas = opts?.gas;
    this.extensionOptions = opts?.extensionOptions ?? [];
    this.nonCriticalExtensionOptions = opts?.nonCriticalExtensionOptions ?? [];
    this.memo = opts?.memo ?? '';
    this.timeoutHeight = opts?.timeoutHeight ?? 0n;
  }

  setSignature(network: CosmosNetworkConfig, signer: Signer<any>, signature: Uint8Array): this {
    this.#signer = signer;
    this.#signature = signature;
    this.#network = network;
    return this;
  }

  setGas(gas: Gas): this {
    this.gas = gas;
    return this;
  }

  computeGas(network: CosmosNetworkConfig, size: bigint | number, populate?: boolean): Gas {
    const [cfg] = network.gas;
    const gas = Decimal.parse(size);
    const amount = gas.mul(Decimal.parse(cfg.lowPrice ?? cfg.avgPrice)).rebase(0).valueOf() + 1n;
    const result = {
      amount: [{ denom: cfg.asset.denom, amount }],
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
  simulate(network: CosmosNetworkConfig, signer: Signer) {
    return Cosmos.rest(network).cosmos.tx.v1beta1.simulate('POST', {
      tx_bytes: SdkTxDirect.encode(this.sdkTx(network, signer)).finish(),
    });
  }

  async estimateGas(network: CosmosNetworkConfig, signer: Signer, populate?: boolean): Promise<Gas> {
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
  signDoc(network: CosmosNetworkConfig, signer: Signer): SignDoc {
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
  sdkTx(network: CosmosNetworkConfig, signer: Signer, signature: Uint8Array = new Uint8Array()): SdkTxDirect {
    const { publicKey, sequence } = signer.getSignData(network)[0];
    if (!network || !publicKey) throw new Error('Account not bound');
    return SdkTxDirect.fromPartial({
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

  fullSdkTx(): SdkTxDirect {
    if (!this.gas) throw new Error('Gas not set');
    if (!this.#signer || !this.#signature || !this.#network) throw new Error('Signature not bound');
    return this.sdkTx(this.#network, this.#signer, this.#signature);
  }

  signBytes(network: CosmosNetworkConfig, signer: Signer): Uint8Array {
    return sha256(SignDoc.encode(this.signDoc(network, signer)).finish());
  }

  bytes(): Uint8Array {
    return SdkTxDirect.encode(this.fullSdkTx()).finish();
  }

  static computeHash(tx: CosmosTxDirect | string) {
    let bytes: Uint8Array;
    if (typeof tx === 'string') {
      bytes = fromBase64(tx);
    } else {
      bytes = SdkTxDirect.encode(tx.fullSdkTx()).finish();
    }

    const buffer = sha256(bytes);
    return toHex(new Uint8Array(buffer));
  }

  get status(): TxStatus { return this.#status }
  get signer() { return this.#signer }
  get network() { return this.#network }
  get signature(): Uint8Array | undefined { return this.#signature }
  get hash() { return this.#hash ?? CosmosTxDirect.computeHash(this) }
  get error() { return this.#error }
}

export class CosmosTxAmino implements TxBase {
  readonly ecosystem = 'cosmos';
  readonly encoding = 'amino';
  memo = '';
  gas: Gas | undefined;
  #status: TxStatus = 'unsigned';
  #signer: Signer | undefined;
  #signature: Uint8Array | undefined;
  #network: CosmosNetworkConfig | undefined;
  #hash: string | undefined;
  #error: string | undefined;

  constructor(public messages: any[] = [], opts?: AminoTxOptions) {
    this.memo = opts?.memo ?? '';
    this.gas = opts?.gas;
  }

  setSignature(network: CosmosNetworkConfig, signer: Signer<any>, signature: Uint8Array): this {
    this.#network = network;
    this.#signer = signer;
    this.#signature = signature;
    return this;
  }

  setGas(gas: Gas): this {
    this.gas = gas;
    return this;
  }

  computeGas(network: CosmosNetworkConfig, size: bigint | number, populate?: boolean): Gas {
    const [cfg] = network.gas;
    const gas = Decimal.parse(size);
    const amount = gas.mul(Decimal.parse(cfg.lowPrice ?? cfg.avgPrice)).rebase(0).valueOf() + 1n;
    const result = {
      amount: [{ denom: cfg.asset.denom, amount }],
      gasLimit: gas.valueOf(),
    } satisfies Gas;
    if (populate) this.gas = result;
    return result;
  }

  confirm(hash: string): void {
    this.#hash = hash;
    this.#status = 'confirmed';
  }

  reject(hash: string, error: string): void {
    this.#hash = hash;
    this.#error = error;
    this.#status = 'failed';
  }

  simulate(network: CosmosNetworkConfig, signer: Signer) {
    return Cosmos.rest(network).cosmos.tx.v1beta1.simulate('POST', {
      tx_bytes: fromUtf8(JSON.stringify(this.sdkTx(network, signer))),
    });
  }

  async estimateGas(network: CosmosNetworkConfig, signer: Signer, populate?: boolean): Promise<Gas> {
    const { gas_info } = await this.simulate(network, signer);
    if (!gas_info) throw new Error('Failed to simulate transaction');
    const units = Decimal.parse(gas_info.gas_used).mul(Decimal.parse(network.gasFactor ?? config.gasFactor)).rebase(0);
    return this.computeGas(network, units.valueOf(), populate);
  }

  broadcast(): Promise<string> {
    if (!this.#signer) throw new Error('Signer not bound');
    return this.#signer.broadcast(this);
  }

  signDoc(network: CosmosNetworkConfig, signer: Signer) {
    const signData = signer.getSignData(network)[0];
    if (!signData) throw new Error('Signer not bound');
    const mwstack = mw('encoding', 'encode').inv();
    return mwstack.fifo(network, 'amino', {
      chainId: network.chainId,
      accountNumber: signData.accountNumber,
      sequence: signData.sequence,
      fee: this.gas ?? {},
      memo: this.memo,
      msgs: this.messages.map(msg => mwstack.fifo(network, 'amino', msg)),
    });
  }

  sdkTx(network: CosmosNetworkConfig, signer: Signer, signature: Uint8Array = new Uint8Array()) {
    const mwstack = mw('encoding', 'encode').inv();
    const signatures = signature ? [{
      pubKey: signer.getSignData(network)[0].publicKey,
      signature,
    }] : [];
    return mwstack.fifo(network, 'amino', {
      msg: this.messages.map(msg => mwstack.fifo(network, 'amino', msg)),
      fee: this.gas ?? {},
      memo: this.memo,
      signatures,
    });
  }

  fullSdkTx() {
    if (!this.#network || !this.#signer || !this.#signature || !this.gas) throw new Error('Network, signer, signature, or gas not bound');
    return this.sdkTx(this.#network, this.#signer, this.#signature);
  }

  signBytes(network: CosmosNetworkConfig, signer: Signer): Uint8Array {
    return sha256(JSON.stringify(this.signDoc(network, signer)));
  }

  bytes(): Uint8Array {
    return fromUtf8(JSON.stringify(this.fullSdkTx()));
  }

  static computeHash(tx: CosmosTxAmino | string) {
    let bytes: Uint8Array;
    if (typeof tx === 'string') {
      bytes = fromUtf8(tx);
    } else {
      bytes = tx.bytes();
    }

    const buffer = sha256(bytes);
    return toHex(new Uint8Array(buffer));
  }

  get status() { return this.#status }
  get signer() { return this.#signer }
  get signature() { return this.#signature }
  get network() { return this.#network }
  get hash() { return this.#hash ?? CosmosTxAmino.computeHash(this) }
  get error() { return this.#error }
}