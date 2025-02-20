import { Any, Bytes, config, type CosmosNetworkConfig, type Signer, TxBase, TxStatus } from '@apophis-sdk/core';
import type { Gas } from '@apophis-sdk/core/types.sdk.js';
import { extendDefaultMarshaller, IgnoreMarshalUnit } from '@kiruse/marshal';
import { Decimal } from '@kiruse/decimal';
import { sha256 } from '@noble/hashes/sha256';
import { AuthInfo, Tx as SdkTxDirect, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Cosmos } from './api';
import { fromBase64, fromUtf8, toHex } from '@apophis-sdk/core/utils.js';
import { mw } from '@apophis-sdk/core/middleware.js';
import { Amino } from './encoding/amino';

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
  timeoutHeight?: number | bigint;
}

export type CosmosTx = CosmosTxDirect | CosmosTxAmino;

export const TxMarshaller = extendDefaultMarshaller([
  IgnoreMarshalUnit(Uint8Array),
]);

export abstract class CosmosTxBase<SdkTx> implements TxBase {
  readonly ecosystem = 'cosmos';
  #status: TxStatus = 'unsigned';
  #signer: Signer | undefined;
  #signature: Uint8Array | undefined;
  #network: CosmosNetworkConfig | undefined;
  #hash: string | undefined;
  #error: string | undefined;
  gas: Gas | undefined;
  memo = '';

  abstract get encoding(): CosmosTxEncoding;

  setSignature(network: CosmosNetworkConfig, signer: Signer<any>, signature: Uint8Array) {
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
    const offset = Decimal.parse(cfg.flatGasOffset ?? 50_000);
    const multiplier = Decimal.parse(cfg.gasMultiplier ?? 1);

    const gas = Decimal.parse(size).add(offset).mul(multiplier);

    const amount = gas.mul(Decimal.parse(cfg.lowPrice ?? cfg.avgPrice)).rebase(0).valueOf() + 1n;
    const result = {
      amount: [{ denom: cfg.asset.denom, amount }],
      gasLimit: gas.valueOf(),
    } satisfies Gas;
    if (populate) this.gas = result;
    return result;
  }

  /** Non-interface method to simulate this transaction. `estimateGas` extracts the `gas_info` from this method's result. */
  simulate(network: CosmosNetworkConfig, signer: Signer) {
    return Cosmos.rest(network).cosmos.tx.v1beta1.simulate('POST', {
      tx_bytes: this.sdkTxBytes(network, signer),
    });
  }

  /** Estimate gas consumption this TX would require, and optionally populate the `gas` field. */
  async estimateGas(network: CosmosNetworkConfig, signer: Signer, populate?: boolean): Promise<Gas> {
    const { gas_info } = await this.simulate(network, signer);
    if (!gas_info) throw new Error('Failed to simulate transaction');
    const units = Decimal.parse(gas_info.gas_used).mul(Decimal.parse(network.gasFactor ?? config.gasFactor)).rebase(0);
    return this.computeGas(network, units.valueOf(), populate);
  }

  confirm(hash: string): void {
    this.#status = 'confirmed';
    this.#hash = hash;
  }

  reject(hash: string, error: string): void {
    this.#status = 'failed';
    this.#hash = hash;
    this.#error = error;
  }

  broadcast(): Promise<string> {
    if (!this.#signer) throw new Error('Signer not bound');
    return this.#signer.broadcast(this);
  }

  abstract signBytes(network: CosmosNetworkConfig, signer: Signer): Uint8Array;
  abstract sdkTx(network: CosmosNetworkConfig, signer: Signer, signature?: Uint8Array): SdkTx;
  abstract sdkTxBytes(network: CosmosNetworkConfig, signer: Signer, signature?: Uint8Array): Uint8Array;

  fullSdkTx() {
    if (!this.gas) throw new Error('Gas not set');
    if (!this.signer || !this.signature || !this.network) throw new Error('Signature not bound');
    return this.sdkTx(this.network, this.signer, this.signature);
  }

  /** Get the full bytes of this transaction. Requires signature and gas. */
  abstract bytes(): Uint8Array;

  static computeHash(tx: CosmosTx | string) {
    let hash: Bytes;
    if (typeof tx === 'string') {
      if (tx.startsWith('{') && tx.endsWith('}')) {
        hash = sha256(tx);
      } else {
        hash = sha256(fromBase64(tx));
      }
    } else {
      hash = sha256(tx.bytes());
    }
    return toHex(hash);
  }

  get status(): TxStatus { return this.#status }
  get signer(): Signer<TxBase> | undefined { return this.#signer }
  get signature(): Uint8Array | undefined { return this.#signature }
  get network(): CosmosNetworkConfig | undefined { return this.#network }
  get hash(): string { return this.#hash ?? CosmosTxBase.computeHash(this as any) }
  get error(): string | undefined { return this.#error }
}

/** A transaction builder which accumulates data throughout the various steps of the transaction life cycle. */
export class CosmosTxDirect extends CosmosTxBase<SdkTxDirect> {
  readonly encoding = 'protobuf';
  extensionOptions: Any[] = [];
  nonCriticalExtensionOptions: Any[] = [];
  /** Typically, timeout height of 0 is synonymous with "no timeout". */
  timeoutHeight = 0n;

  constructor(public messages: any[] = [], opts?: DirectTxOptions) {
    super();
    this.gas = opts?.gas;
    this.extensionOptions = opts?.extensionOptions ?? [];
    this.nonCriticalExtensionOptions = opts?.nonCriticalExtensionOptions ?? [];
    this.memo = opts?.memo ?? '';
    this.timeoutHeight = opts?.timeoutHeight ?? 0n;
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

  signBytes(network: CosmosNetworkConfig, signer: Signer): Uint8Array {
    return sha256(SignDoc.encode(this.signDoc(network, signer)).finish());
  }

  /** Get a partial Cosmos SDK Tx object. This does not require gas or signature, in which case it can be used for simulation (including gas estimation). */
  sdkTx(network: CosmosNetworkConfig, signer: Signer, signature: Uint8Array = new Uint8Array()): SdkTxDirect {
    if (!this.messages.length) throw new Error('No messages provided');
    const { publicKey, sequence } = signer.getSignData(network)[0];
    if (!network || !publicKey) throw new Error('Account not bound');
    return SdkTxDirect.fromPartial(TxMarshaller.marshal({
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
    }) as any);
  }

  sdkTxBytes(network: CosmosNetworkConfig, signer: Signer, signature?: Uint8Array): Uint8Array {
    return SdkTxDirect.encode(this.sdkTx(network, signer, signature)).finish();
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
}

// Note: With the introduction of protobuf, Amino is supported by the Direct Tx type by legacy amino sign mode.
export class CosmosTxAmino extends CosmosTxBase<SdkTxDirect> {
  readonly encoding = 'amino';
  timeoutHeight = 0n;

  constructor(public messages: any[] = [], opts?: AminoTxOptions) {
    super();
    this.memo = opts?.memo ?? '';
    this.gas = opts?.gas;
    this.timeoutHeight = opts?.timeoutHeight ? BigInt(opts.timeoutHeight) : 0n;
  }

  signDoc(network: CosmosNetworkConfig, signer: Signer) {
    const signData = signer.getSignData(network)[0];
    if (!signData) throw new Error('Signer not bound');
    const mwstack = mw('encoding', 'encode').inv();
    return Amino.normalize({
      chainId: network.chainId,
      accountNumber: signData.accountNumber,
      sequence: signData.sequence,
      fee: this.gas ? {
        amount: this.gas.amount,
        gas: this.gas.gasLimit,
      }: {},
      memo: this.memo,
      msgs: this.messages.map(msg => mwstack.fifo(network, 'amino', msg)),
    });
  }

  signBytes(network: CosmosNetworkConfig, signer: Signer): Uint8Array {
    return sha256(JSON.stringify(this.signDoc(network, signer)));
  }

  sdkTx(network: CosmosNetworkConfig, signer: Signer, signature: Uint8Array = new Uint8Array()) {
    if (!this.messages.length) throw new Error('No messages provided');

    const signerData = signer.getSignData(network)[0];
    if (!signerData) throw new Error('Signer not bound');

    // NOTE: amino is deprecated. with the introduction of protobuf, the SDK also introduced the
    // SIGN_MODE_LEGACY_AMINO_JSON type. this type adds backwards compatibility to the new Tx type
    // for the old StdSignDoc of Amino.
    // ref: https://github.com/cosmos/cosmjs/blob/25d967ae5556d8bd172e6ead6f730830c1607984/packages/stargate/src/signingstargateclient.ts#L387
    return SdkTxDirect.fromPartial(TxMarshaller.marshal({
      body: {
        messages: this.messages.map(msg => Any.toTrueAny(Any.encode(network, msg))),
        memo: this.memo,
        timeoutHeight: this.timeoutHeight,
      },
      authInfo: {
        signerInfos: [{
          publicKey: Any.toTrueAny(Any.encode(network, signerData.publicKey)),
          sequence: signerData.sequence,
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
            },
          },
        }],
        fee: this.gas ?? {},
      },
      signatures: [signature],
    }) as any);
  }

  sdkTxBytes(network: CosmosNetworkConfig, signer: Signer, signature?: Uint8Array): Uint8Array {
    return SdkTxDirect.encode(this.sdkTx(network, signer, signature)).finish();
  }

  bytes(): Uint8Array {
    return SdkTxDirect.encode(this.fullSdkTx()).finish();
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
}