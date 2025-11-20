import { registerDefaultProtobufSchema } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { fromBase64 } from '@apophis-sdk/core/utils.js';
import { assertABCIQuery } from '@apophis-sdk/cosmos/abciquery.js';
import { AminoMarshaller, registerDefaultAminos } from '@apophis-sdk/cosmos/encoding/amino.js';
import { aminoTransform, pbCoin, pbPageRequest, pbPageResponse } from '@apophis-sdk/cosmos/encoding/protobuf/core.js';
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
    instantiatePermission: hpb.submessage(5, Query.pbAccessConfig),
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

  //#region UpdateAdmin
  export const pbUpdateAdmin = hpb.message({
    sender: hpb.string(1).required(),
    newAdmin: hpb.string(2).required(),
    contract: hpb.string(3).required(),
  });

  export type UpdateAdminData = hpb.infer<typeof pbUpdateAdmin>;

  export class UpdateAdmin {
    static readonly aminoTypeUrl = 'wasm/MsgUpdateAdmin';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgUpdateAdmin';
    static readonly protobufSchema = pbUpdateAdmin;
    constructor(public data: UpdateAdminData) {}
  }

  registerDefaultAminos(UpdateAdmin);
  registerDefaultProtobufSchema(UpdateAdmin);
  //#endregion UpdateAdmin

  //#region ClearAdmin
  export const pbClearAdmin = hpb.message({
    sender: hpb.string(1).required(),
    contract: hpb.string(3).required(),
  });

  export type ClearAdminData = hpb.infer<typeof pbClearAdmin>;

  export class ClearAdmin {
    static readonly aminoTypeUrl = 'wasm/MsgClearAdmin';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgClearAdmin';
    static readonly protobufSchema = pbClearAdmin;
    constructor(public data: ClearAdminData) {}
  }

  registerDefaultAminos(ClearAdmin);
  registerDefaultProtobufSchema(ClearAdmin);
  //#endregion ClearAdmin

  //#region UpdateInstantiateConfig
  export const pbUpdateInstantiateConfig = hpb.message({
    sender: hpb.string(1).required(),
    codeId: hpb.uint64(2).required(),
    newInstantiatePermission: hpb.submessage(3, Query.pbAccessConfig),
  });

  export type UpdateInstantiateConfigData = hpb.infer<typeof pbUpdateInstantiateConfig>;

  export class UpdateInstantiateConfig {
    static readonly aminoTypeUrl = 'wasm/MsgUpdateInstantiateConfig';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgUpdateInstantiateConfig';
    static readonly protobufSchema = pbUpdateInstantiateConfig;
    constructor(public data: UpdateInstantiateConfigData) {}
  }

  registerDefaultAminos(UpdateInstantiateConfig);
  registerDefaultProtobufSchema(UpdateInstantiateConfig);
  //#endregion UpdateInstantiateConfig

  //#region UpdateParams
  export const pbUpdateParams = hpb.message({
    authority: hpb.string(1).required(),
    params: hpb.submessage(2, Query.pbParams).required(),
  });

  export type UpdateParamsData = hpb.infer<typeof pbUpdateParams>;

  export class UpdateParams {
    static readonly aminoTypeUrl = 'wasm/MsgUpdateParams';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgUpdateParams';
    static readonly protobufSchema = pbUpdateParams;
    constructor(public data: UpdateParamsData) {}
  }

  registerDefaultAminos(UpdateParams);
  registerDefaultProtobufSchema(UpdateParams);
  //#endregion UpdateParams

  //#region SudoContract
  export const pbSudoContract = hpb.message({
    authority: hpb.string(1).required(),
    contract: hpb.string(2).required(),
    msg: hpb.json<any>(3).required().transform(aminoTransform),
  });

  export type SudoContractData = hpb.infer<typeof pbSudoContract>;

  export class SudoContract {
    static readonly aminoTypeUrl = 'wasm/MsgSudoContract';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgSudoContract';
    static readonly protobufSchema = pbSudoContract;
    constructor(public data: SudoContractData) {}
  }

  registerDefaultAminos(SudoContract);
  registerDefaultProtobufSchema(SudoContract);
  //#endregion SudoContract

  //#region PinCodes
  export const pbPinCodes = hpb.message({
    authority: hpb.string(1).required(),
    codeIds: hpb.repeated.uint64(2).required(),
  });

  export type PinCodesData = hpb.infer<typeof pbPinCodes>;

  export class PinCodes {
    static readonly aminoTypeUrl = 'wasm/MsgPinCodes';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgPinCodes';
    static readonly protobufSchema = pbPinCodes;
    constructor(public data: PinCodesData) {}
  }

  registerDefaultAminos(PinCodes);
  registerDefaultProtobufSchema(PinCodes);
  //#endregion PinCodes

  //#region UnpinCodes
  export const pbUnpinCodes = hpb.message({
    authority: hpb.string(1).required(),
    codeIds: hpb.repeated.uint64(2).required(),
  });

  export type UnpinCodesData = hpb.infer<typeof pbUnpinCodes>;

  export class UnpinCodes {
    static readonly aminoTypeUrl = 'wasm/MsgUnpinCodes';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgUnpinCodes';
    static readonly protobufSchema = pbUnpinCodes;
    constructor(public data: UnpinCodesData) {}
  }

  registerDefaultAminos(UnpinCodes);
  registerDefaultProtobufSchema(UnpinCodes);
  //#endregion UnpinCodes

  //#region StoreAndInstantiateContract
  export const pbStoreAndInstantiateContract = hpb.message({
    authority: hpb.string(1).required(),
    wasmByteCode: hpb.bytes(3).required().transform<Uint8Array>({
      encode: value => value,
      decode: value => Bytes.getUint8Array(value),
      get default() { return new Uint8Array() },
    }),
    instantiatePermission: hpb.submessage(4, Query.pbAccessConfig),
    unpinCode: hpb.bool(5),
    admin: hpb.string(6),
    label: hpb.string(7),
    msg: hpb.json<any>(8).required().transform(aminoTransform),
    funds: hpb.repeated.submessage(9, pbCoin).required(),
    source: hpb.string(10),
    builder: hpb.string(11),
    codeHash: hpb.bytes(12),
  });

  export type StoreAndInstantiateContractData = hpb.infer<typeof pbStoreAndInstantiateContract>;

  export class StoreAndInstantiateContract {
    static readonly aminoTypeUrl = 'wasm/MsgStoreAndInstantiateContract';
    static readonly aminoMarshaller = addMarshallerFinalizer<StoreAndInstantiateContractData>(marshaller, value => ({
      ...value,
      wasmByteCode: fromBase64(value.wasmByteCode),
    }));
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgStoreAndInstantiateContract';
    static readonly protobufSchema = pbStoreAndInstantiateContract;
    constructor(public data: StoreAndInstantiateContractData) {}
  }

  registerDefaultAminos(StoreAndInstantiateContract);
  registerDefaultProtobufSchema(StoreAndInstantiateContract);
  //#endregion StoreAndInstantiateContract

  //#region AddCodeUploadParamsAddresses
  export const pbAddCodeUploadParamsAddresses = hpb.message({
    authority: hpb.string(1).required(),
    addresses: hpb.repeated.string(2).required(),
  });

  export type AddCodeUploadParamsAddressesData = hpb.infer<typeof pbAddCodeUploadParamsAddresses>;

  export class AddCodeUploadParamsAddresses {
    static readonly aminoTypeUrl = 'wasm/MsgAddCodeUploadParamsAddresses';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgAddCodeUploadParamsAddresses';
    static readonly protobufSchema = pbAddCodeUploadParamsAddresses;
    constructor(public data: AddCodeUploadParamsAddressesData) {}
  }

  registerDefaultAminos(AddCodeUploadParamsAddresses);
  registerDefaultProtobufSchema(AddCodeUploadParamsAddresses);
  //#endregion AddCodeUploadParamsAddresses

  //#region RemoveCodeUploadParamsAddresses
  export const pbRemoveCodeUploadParamsAddresses = hpb.message({
    authority: hpb.string(1).required(),
    addresses: hpb.repeated.string(2).required(),
  });

  export type RemoveCodeUploadParamsAddressesData = hpb.infer<typeof pbRemoveCodeUploadParamsAddresses>;

  export class RemoveCodeUploadParamsAddresses {
    static readonly aminoTypeUrl = 'wasm/MsgRemoveCodeUploadParamsAddresses';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgRemoveCodeUploadParamsAddresses';
    static readonly protobufSchema = pbRemoveCodeUploadParamsAddresses;
    constructor(public data: RemoveCodeUploadParamsAddressesData) {}
  }

  registerDefaultAminos(RemoveCodeUploadParamsAddresses);
  registerDefaultProtobufSchema(RemoveCodeUploadParamsAddresses);
  //#endregion RemoveCodeUploadParamsAddresses

  //#region StoreAndMigrateContract
  export const pbStoreAndMigrateContract = hpb.message({
    authority: hpb.string(1).required(),
    wasmByteCode: hpb.bytes(2).required().transform<Uint8Array>({
      encode: value => value,
      decode: value => Bytes.getUint8Array(value),
      get default() { return new Uint8Array() },
    }),
    instantiatePermission: hpb.submessage(3, Query.pbAccessConfig),
    contract: hpb.string(4).required(),
    msg: hpb.json<any>(5).required().transform(aminoTransform),
  });

  export type StoreAndMigrateContractData = hpb.infer<typeof pbStoreAndMigrateContract>;

  export class StoreAndMigrateContract {
    static readonly aminoTypeUrl = 'wasm/MsgStoreAndMigrateContract';
    static readonly aminoMarshaller = addMarshallerFinalizer<StoreAndMigrateContractData>(marshaller, value => ({
      ...value,
      wasmByteCode: fromBase64(value.wasmByteCode),
    }));
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgStoreAndMigrateContract';
    static readonly protobufSchema = pbStoreAndMigrateContract;
    constructor(public data: StoreAndMigrateContractData) {}
  }

  registerDefaultAminos(StoreAndMigrateContract);
  registerDefaultProtobufSchema(StoreAndMigrateContract);
  //#endregion StoreAndMigrateContract

  //#region UpdateContractLabel
  export const pbUpdateContractLabel = hpb.message({
    sender: hpb.string(1).required(),
    newLabel: hpb.string(2).required(),
    contract: hpb.string(3).required(),
  });

  export type UpdateContractLabelData = hpb.infer<typeof pbUpdateContractLabel>;

  export class UpdateContractLabel {
    static readonly aminoTypeUrl = 'wasm/MsgUpdateContractLabel';
    static readonly aminoMarshaller = marshaller;
    static readonly protobufTypeUrl = '/cosmwasm.wasm.v1.MsgUpdateContractLabel';
    static readonly protobufSchema = pbUpdateContractLabel;
    constructor(public data: UpdateContractLabelData) {}
  }

  registerDefaultAminos(UpdateContractLabel);
  registerDefaultProtobufSchema(UpdateContractLabel);
  //#endregion UpdateContractLabel

  export namespace Query {
    //#region Shared Types
    export const pbAccessConfig = hpb.message({
      permission: hpb.int32(1).required(),
      addresses: hpb.repeated.string(2),
    });

    export const pbContractInfo = hpb.message({
      codeId: hpb.uint64(1).required(),
      creator: hpb.string(2).required(),
      admin: hpb.string(3),
      label: hpb.string(4),
      created: hpb.submessage(5, {
        blockHeight: hpb.uint64(1),
        txIndex: hpb.uint64(2),
      }),
      ibcPortId: hpb.string(6),
      extension: hpb.bytes(7),
    });

    export const pbModel = hpb.message({
      key: hpb.bytes(1).required(),
      value: hpb.bytes(2).required(),
    });

    export const pbContractCodeHistoryEntry = hpb.message({
      operation: hpb.int32(1).required(),
      codeId: hpb.uint64(2).required(),
      updated: hpb.submessage(3, {
        blockHeight: hpb.uint64(1),
        txIndex: hpb.uint64(2),
      }),
      msg: hpb.bytes(4),
    });

    // CodeInfoResponse is used in Code and Codes queries
    export const pbCodeInfoResponse = hpb.message({
      codeId: hpb.uint64(1).required(),
      creator: hpb.string(2).required(),
      dataHash: hpb.bytes(3).required(),
      instantiatePermission: hpb.submessage(6, pbAccessConfig).required(),
    });

    export const pbParams = hpb.message({
      codeUploadAccess: hpb.submessage(1, pbAccessConfig).required(),
      instantiateDefaultPermission: hpb.int32(2).required(),
    });
    //#endregion

    //#region ContractInfo
    export const pbContractInfoRequest = hpb.message({
      address: hpb.string(1).required(),
    });

    export const pbContractInfoResponse = hpb.message({
      address: hpb.string(1).required(),
      contractInfo: hpb.submessage(2, pbContractInfo).required(),
    });

    export namespace ContractInfo {
      export const path = '/cosmwasm.wasm.v1.Query/ContractInfo';
      export const request = pbContractInfoRequest;
      export const response = pbContractInfoResponse;
    }
    assertABCIQuery(ContractInfo);
    //#endregion

    //#region ContractHistory
    export const pbContractHistoryRequest = hpb.message({
      address: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbContractHistoryResponse = hpb.message({
      entries: hpb.repeated.submessage(1, pbContractCodeHistoryEntry).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace ContractHistory {
      export const path = '/cosmwasm.wasm.v1.Query/ContractHistory';
      export const request = pbContractHistoryRequest;
      export const response = pbContractHistoryResponse;
    }
    assertABCIQuery(ContractHistory);
    //#endregion

    //#region ContractsByCode
    export const pbContractsByCodeRequest = hpb.message({
      codeId: hpb.uint64(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbContractsByCodeResponse = hpb.message({
      contracts: hpb.repeated.string(1).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace ContractsByCode {
      export const path = '/cosmwasm.wasm.v1.Query/ContractsByCode';
      export const request = pbContractsByCodeRequest;
      export const response = pbContractsByCodeResponse;
    }
    assertABCIQuery(ContractsByCode);
    //#endregion

    //#region AllContractState
    export const pbAllContractStateRequest = hpb.message({
      address: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbAllContractStateResponse = hpb.message({
      models: hpb.repeated.submessage(1, pbModel).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace AllContractState {
      export const path = '/cosmwasm.wasm.v1.Query/AllContractState';
      export const request = pbAllContractStateRequest;
      export const response = pbAllContractStateResponse;
    }
    assertABCIQuery(AllContractState);
    //#endregion

    //#region RawContractState
    export const pbRawContractStateRequest = hpb.message({
      address: hpb.string(1).required(),
      queryData: hpb.bytes(2).required(),
    });

    export const pbRawContractStateResponse = hpb.message({
      data: hpb.bytes(1).required(),
    });

    export namespace RawContractState {
      export const path = '/cosmwasm.wasm.v1.Query/RawContractState';
      export const request = pbRawContractStateRequest;
      export const response = pbRawContractStateResponse;
    }
    assertABCIQuery(RawContractState);
    //#endregion

    //#region SmartContractState
    export const pbSmartContractStateRequest = hpb.message({
      address: hpb.string(1).required(),
      queryData: hpb.bytes(2).required(),
    });

    export const pbSmartContractStateResponse = hpb.message({
      data: hpb.bytes(1).required(),
    });

    export namespace SmartContractState {
      export const path = '/cosmwasm.wasm.v1.Query/SmartContractState';
      export const request = pbSmartContractStateRequest;
      export const response = pbSmartContractStateResponse;
    }
    assertABCIQuery(SmartContractState);
    //#endregion

    //#region Code
    export const pbCodeRequest = hpb.message({
      codeId: hpb.uint64(1).required(),
    });

    export const pbCodeResponse = hpb.message({
      codeInfo: hpb.submessage(1, pbCodeInfoResponse).required(),
      data: hpb.bytes(2).required(),
    });

    export namespace Code {
      export const path = '/cosmwasm.wasm.v1.Query/Code';
      export const request = pbCodeRequest;
      export const response = pbCodeResponse;
    }
    assertABCIQuery(Code);
    //#endregion

    //#region Codes
    export const pbCodesRequest = hpb.message({
      pagination: hpb.submessage(1, pbPageRequest),
    });

    export const pbCodesResponse = hpb.message({
      codeInfos: hpb.repeated.submessage(1, pbCodeInfoResponse).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace Codes {
      export const path = '/cosmwasm.wasm.v1.Query/Codes';
      export const request = pbCodesRequest;
      export const response = pbCodesResponse;
    }
    assertABCIQuery(Codes);
    //#endregion

    //#region CodeInfo
    export const pbCodeInfoRequest = hpb.message({
      codeId: hpb.uint64(1).required(),
    });

    // QueryCodeInfoResponse is different from CodeInfoResponse - it uses checksum instead of dataHash
    export const pbQueryCodeInfoResponse = hpb.message({
      codeId: hpb.uint64(1).required(),
      creator: hpb.string(2).required(),
      checksum: hpb.bytes(3).required(),
      instantiatePermission: hpb.submessage(4, pbAccessConfig).required(),
    });

    export namespace CodeInfo {
      export const path = '/cosmwasm.wasm.v1.Query/CodeInfo';
      export const request = pbCodeInfoRequest;
      export const response = pbQueryCodeInfoResponse;
    }
    assertABCIQuery(CodeInfo);
    //#endregion

    //#region PinnedCodes
    export const pbPinnedCodesRequest = hpb.message({
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbPinnedCodesResponse = hpb.message({
      codeIds: hpb.repeated.uint64(1).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace PinnedCodes {
      export const path = '/cosmwasm.wasm.v1.Query/PinnedCodes';
      export const request = pbPinnedCodesRequest;
      export const response = pbPinnedCodesResponse;
    }
    assertABCIQuery(PinnedCodes);
    //#endregion

    //#region Params
    export const pbParamsRequest = hpb.message({});

    export const pbParamsResponse = hpb.message({
      params: hpb.submessage(1, pbParams).required(),
    });

    export namespace Params {
      export const path = '/cosmwasm.wasm.v1.Query/Params';
      export const request = pbParamsRequest;
      export const response = pbParamsResponse;
    }
    assertABCIQuery(Params);
    //#endregion

    //#region ContractsByCreator
    export const pbContractsByCreatorRequest = hpb.message({
      creatorAddress: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbContractsByCreatorResponse = hpb.message({
      contractAddresses: hpb.repeated.string(1).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace ContractsByCreator {
      export const path = '/cosmwasm.wasm.v1.Query/ContractsByCreator';
      export const request = pbContractsByCreatorRequest;
      export const response = pbContractsByCreatorResponse;
    }
    assertABCIQuery(ContractsByCreator);
    //#endregion

    //#region WasmLimitsConfig
    export const pbWasmLimitsConfigRequest = hpb.message({});

    export const pbWasmLimitsConfigResponse = hpb.message({
      config: hpb.string(1).required(),
    });

    export namespace WasmLimitsConfig {
      export const path = '/cosmwasm.wasm.v1.Query/WasmLimitsConfig';
      export const request = pbWasmLimitsConfigRequest;
      export const response = pbWasmLimitsConfigResponse;
    }
    assertABCIQuery(WasmLimitsConfig);
    //#endregion

    //#region BuildAddress
    export const pbBuildAddressRequest = hpb.message({
      codeHash: hpb.string(1).required(),
      creatorAddress: hpb.string(2).required(),
      salt: hpb.string(3).required(),
      initArgs: hpb.bytes(4),
    });

    export const pbBuildAddressResponse = hpb.message({
      address: hpb.string(1).required(),
    });

    export namespace BuildAddress {
      export const path = '/cosmwasm.wasm.v1.Query/BuildAddress';
      export const request = pbBuildAddressRequest;
      export const response = pbBuildAddressResponse;
    }
    assertABCIQuery(BuildAddress);
    //#endregion
  }
}

/** Convert a snake_case string to camelCase */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Convert a camelCase string to snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
