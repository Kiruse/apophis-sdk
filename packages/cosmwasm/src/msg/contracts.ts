import { registerDefaultProtobufSchema } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { fromBase64 } from '@apophis-sdk/core/utils.js';
import { AminoMarshaller, registerDefaultAminos } from '@apophis-sdk/cosmos/encoding/amino.js';
import { aminoTransform, bigintTransform, pbCoin } from '@apophis-sdk/cosmos/encoding/protobuf/core.js';
import hpb from '@kiruse/hiproto';
import { Bytes } from '@kiruse/hiproto/protobuffer';
import { addMarshallerFinalizer, extendMarshaller, RecaseMarshalUnit } from '@kiruse/marshal';

const marshaller = extendMarshaller(AminoMarshaller, [
  RecaseMarshalUnit(toSnakeCase, toCamelCase),
]);

export namespace Contract {
  //#region StoreCode
  export const pbStoreCode = hpb.message({
    sender: hpb.string(1).required(),
    wasmByteCode: hpb.bytes(2).required().transform<Uint8Array>({
      encode: value => value,
      decode: value => Bytes.getUint8Array(value),
      get default() { return new Uint8Array() },
    }),
  });

  export type StoreCodeData = hpb.infer<typeof pbStoreCode>;

  export class StoreCode {
    static readonly aminoTypeUrl = 'wasm/MsgStoreCode';
    static readonly aminoMarshaller = addMarshallerFinalizer<StoreCodeData>(marshaller, value => ({
      ...value,
      wasmByteCode: fromBase64(value.wasmByteCode),
    }));
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgStoreCode';
    static readonly protobufSchema = pbStoreCode;
    constructor(public data: StoreCodeData) {}
  }

  registerDefaultAminos(StoreCode);
  registerDefaultProtobufSchema(StoreCode);
  //#endregion StoreCode

  //#region Instantiate
  export const pbInstantiate = hpb.message({
    sender: hpb.string(1).required(),
    admin: hpb.string(2),
    codeId: hpb.uint64(3).required(),
    label: hpb.string(4),
    msg: hpb.json<any>(5).required().transform(aminoTransform),
    funds: hpb.repeated.submessage(6, pbCoin).required(),
  });

  export type InstantiateData = hpb.infer<typeof pbInstantiate>;

  export class Instantiate {
    static readonly aminoTypeUrl = 'wasm/MsgInstantiateContract';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract';
    static readonly protobufSchema = pbInstantiate;
    constructor(public data: InstantiateData) {}
  }

  registerDefaultAminos(Instantiate);
  registerDefaultProtobufSchema(Instantiate);
  //#endregion Instantiate

  //#region Instantiate2
  export const pbInstantiate2 = hpb.message({
    sender: hpb.string(1).required(),
    admin: hpb.string(2),
    codeId: hpb.uint64(3).required(),
    label: hpb.string(4),
    msg: hpb.json<any>(5).required().transform(aminoTransform),
    funds: hpb.repeated.submessage(6, pbCoin).required(),
    salt: hpb.bytes(7),
    /** Whether to include the message hash in the calculation for the predictable address. Defaults to false. */
    fixMsg: hpb.bool(8),
  });

  export type Instantiate2Data = hpb.infer<typeof pbInstantiate2>;

  export class Instantiate2 {
    static readonly aminoTypeUrl = 'wasm/MsgInstantiateContract2';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgInstantiateContract2';
    static readonly protobufSchema = pbInstantiate2;
    constructor(public data: Instantiate2Data) {}
  }

  registerDefaultAminos(Instantiate2);
  registerDefaultProtobufSchema(Instantiate2);
  //#endregion Instantiate2

  //#region Migrate
  export const pbMigrate = hpb.message({
    sender: hpb.string(1).required(),
    contract: hpb.string(2).required(),
    codeId: hpb.uint64(3).required(),
    msg: hpb.json<any>(4).required().transform(aminoTransform),
  });

  export type MigrateData = hpb.infer<typeof pbMigrate>;

  export class Migrate {
    static readonly aminoTypeUrl = 'wasm/MsgMigrateContract';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgMigrateContract';
    static readonly protobufSchema = pbMigrate;
    constructor(public data: MigrateData) {}
  }

  registerDefaultAminos(Migrate);
  registerDefaultProtobufSchema(Migrate);
  //#endregion Migrate

  //#region Execute
  export const pbExecute = hpb.message({
    sender: hpb.string(1).required(),
    contract: hpb.string(2).required(),
    msg: hpb.json<any>(3).required().transform(aminoTransform),
    funds: hpb.repeated.submessage(5, pbCoin).required(),
  });

  export type ExecuteData = hpb.infer<typeof pbExecute>;

  export class Execute {
    static readonly aminoTypeUrl = 'wasm/MsgExecuteContract';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgExecuteContract';
    static readonly protobufSchema = pbExecute;
    constructor(public data: ExecuteData) {}
  }

  registerDefaultAminos(Execute);
  registerDefaultProtobufSchema(Execute);
  //#endregion Execute
}

/** Convert a snake_case string to camelCase */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Convert a camelCase string to snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
