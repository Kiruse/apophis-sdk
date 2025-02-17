import { Any } from '@apophis-sdk/core';
import { Coin } from '@apophis-sdk/core/types.sdk.js';
import { AminoMarshaller, AminoMsg, Amino } from '@apophis-sdk/cosmos/encoding.js';
import { MsgExecuteContract, MsgInstantiateContract, MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx.js';

export interface StoreCodePayload {
  sender?: string;
  wasmByteCode: Uint8Array;
}

export interface InstantiatePayload {
  admin?: string;
  sender?: string;
  codeId: bigint;
  label: string;
  msg: Uint8Array;
  funds?: Coin[];
}

export interface ExecutePayload {
  sender?: string;
  contract?: string;
  msg: Uint8Array;
  funds?: Coin[];
}

export const Contract = new class {
  readonly StoreCode = new class implements MessageFactory<StoreCodePayload> {
    readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgStoreCode';
    readonly aminoTypeUrl = 'wasm/MsgStoreCode';

    create(payload: StoreCodePayload): StoreCodePayload {
      return payload;
    }

    canEncode(encoding: string): boolean {
      return encoding === 'prorobuf' || encoding === 'amino';
    }

    isMessage(value: unknown): value is StoreCodePayload {
      return typeof value === 'object' && !!value && 'wasmByteCode' in value;
    }

    isEncoded(encoding: string, value: unknown): boolean {
      switch (encoding) {
        case 'protobuf':
          return Any.isAny(value) && value.typeUrl === this.protobufTypeUrl;
        case 'amino':
          return isAmino(value) && value.type === this.aminoTypeUrl;
        default:
          return false;
      }
    }

    encode(encoding: string, value: StoreCodePayload, context: MessageContext = {}): unknown {
      const getPayload = () => ({
        ...value,
        sender: value.sender ?? context.sender,
      });

      switch (encoding) {
        case 'protobuf':
          return {
            typeUrl: this.protobufTypeUrl,
            value: MsgStoreCode.encode(MsgStoreCode.fromPartial(getPayload())).finish(),
          } satisfies Any;
        case 'amino':
          return {
            type: this.aminoTypeUrl,
            value: AminoMarshaller.marshal(getPayload()),
          } satisfies AminoMsg;
        default:
          throw new Error('Unsupported encoding');
      }
    }

    decode(encoding: string, value: unknown, context: MessageContext = {}): StoreCodePayload {
      switch (encoding) {
        case 'protobuf':
          if (!Any.isAny(value) || value.typeUrl !== this.protobufTypeUrl) throw new Error('invalid value');
          return MsgStoreCode.decode((value as Any).value);
        case 'amino':
          if (!isAmino(value) || value.type !== this.aminoTypeUrl) throw new Error('invalid value');
          return AminoMarshaller.unmarshal(value) as StoreCodePayload;
        default:
          throw new Error('Unsupported encoding');
      }
    }
  }

  readonly Instantiate = new class implements MessageFactory<InstantiatePayload> {
    readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract';
    readonly aminoTypeUrl = 'wasm/MsgInstantiateContract';

    create(payload: InstantiatePayload): InstantiatePayload {
      return payload;
    }

    canEncode(encoding: string): boolean {
      return encoding === 'protobuf' || encoding === 'amino';
    }

    isMessage(value: unknown): value is InstantiatePayload {
      return typeof value === 'object' && !!value && 'codeId' in value;
    }

    isEncoded(encoding: string, value: unknown): boolean {
      switch (encoding) {
        case 'protobuf':
          return Any.isAny(value) && value.typeUrl === this.protobufTypeUrl;
        case 'amino':
          return isAmino(value) && value.type === this.aminoTypeUrl;
        default:
          return false;
      }
    }

    encode(encoding: string, value: InstantiatePayload, context: MessageContext = {}): unknown {
      const getPayload = () => ({
        ...value,
        sender: value.sender ?? context.sender,
      });

      switch (encoding) {
        case 'protobuf':
          return {
            typeUrl: this.protobufTypeUrl,
            value: MsgInstantiateContract.encode(MsgInstantiateContract.fromPartial(getPayload())).finish(),
          } satisfies Any;
        case 'amino':
          return {
            type: this.aminoTypeUrl,
            value: AminoMarshaller.marshal(getPayload()),
          } satisfies AminoMsg;
        default:
          throw new Error('Unsupported encoding');
      }
    }

    decode(encoding: string, value: unknown, context: MessageContext = {}): InstantiatePayload {
      switch (encoding) {
        case 'protobuf':
          if (!Any.isAny(value) || value.typeUrl !== this.protobufTypeUrl) throw new Error('invalid value');
          return MsgInstantiateContract.decode((value as Any).value);
        case 'amino':
          if (!isAmino(value) || value.type !== this.aminoTypeUrl) throw new Error('invalid value');
          return AminoMarshaller.unmarshal(value) as InstantiatePayload;
        default:
          throw new Error('Unsupported encoding');
      }
    }
  }

  readonly Execute = new class implements MessageFactory<ExecutePayload> {
    readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract';
    readonly aminoTypeUrl = 'wasm/MsgExecuteContract';

    create(payload: ExecutePayload): ExecutePayload {
      return payload;
    }

    canEncode(encoding: string): boolean {
      return encoding === 'prorobuf' || encoding === 'amino';
    }

    isMessage(value: unknown): value is ExecutePayload {
      return typeof value === 'object' && !!value && 'contract' in value;
    }

    isEncoded(encoding: string, value: unknown): boolean {
      switch (encoding) {
        case 'protobuf':
          return Any.isAny(value) && value.typeUrl === this.protobufTypeUrl;
        case 'amino':
          return isAmino(value) && value.type === this.aminoTypeUrl;
        default:
          return false;
      }
    }

    encode(encoding: string, value: ExecutePayload, context: MessageContext = {}): unknown {
      const getPayload = () => ({
        ...value,
        sender: value.sender ?? context.sender,
      });

      switch (encoding) {
        case 'protobuf':
          return {
            typeUrl: this.protobufTypeUrl,
            value: MsgExecuteContract.encode(MsgExecuteContract.fromPartial(getPayload())).finish(),
          } satisfies Any;
        case 'amino':
          return {
            type: this.aminoTypeUrl,
            value: AminoMarshaller.marshal(getPayload()),
          } satisfies AminoMsg;
        default:
          throw new Error('Unsupported encoding');
      }
    }

    decode(encoding: string, value: unknown, context: MessageContext = {}): ExecutePayload {
      switch (encoding) {
        case 'protobuf':
          if (!Any.isAny(value) || value.typeUrl !== this.protobufTypeUrl) throw new Error('invalid value');
          return MsgExecuteContract.decode((value as Any).value);
        case 'amino':
          if (!isAmino(value) || value.type !== this.aminoTypeUrl) throw new Error('invalid value');
          return AminoMarshaller.unmarshal(value) as ExecutePayload;
        default:
          throw new Error('Unsupported encoding');
      }
    }
  }
}
