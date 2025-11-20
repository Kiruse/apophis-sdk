import { CosmosNetworkConfig } from '@apophis-sdk/core';
import { registerDefaultProtobufSchema } from '@apophis-sdk/core/encoding/protobuf/any.js';
import { hpb } from '@kiruse/hiproto';
import { assertABCIQuery } from '../abciquery.js';
import { Cosmos } from '../api.js';
import { registerDefaultAminos } from '../encoding/amino.js';
import { pbCoin, pbPageRequest, pbPageResponse } from '../encoding/protobuf/core.js';

export namespace Bank {
  export type DenomMetadata = hpb.infer<typeof Query.pbMetadata>;

  //#region Send
  export type SendData = hpb.infer<typeof pbSendData>;

  export const pbSendData = hpb.message({
    fromAddress: hpb.string(1),
    toAddress: hpb.string(2),
    amount: hpb.repeated.submessage(3, pbCoin),
  });

  export class Send {
    static readonly aminoTypeUrl = 'cosmos-sdk/MsgSend';
    static readonly protobufTypeUrl = '/cosmos.bank.v1beta1.MsgSend';
    static readonly protobufSchema = pbSendData;
    constructor(public data: SendData) {}
  };

  registerDefaultProtobufSchema(Send);
  registerDefaultAminos(Send);
  //#endregion

  export namespace Query {
    //#region DenomMetadata
    export const pbMetadata = hpb.message({
      description: hpb.string(1),
      denomUnits: hpb.repeated.submessage(2, {
        denom: hpb.string(1),
        exponent: hpb.uint32(2),
        aliases: hpb.repeated.string(3),
      }),
      base: hpb.string(3),
      display: hpb.string(4),
      name: hpb.string(5),
      symbol: hpb.string(6),
      uri: hpb.string(7),
      uriHash: hpb.string(8),
    });

    export const pbDenomsMetadataRequest = hpb.message({
      pagination: hpb.submessage(1, pbPageRequest),
    });

    export const pbDenomsMetadataResponse = hpb.message({
      metadata: hpb.repeated.submessage(1, pbMetadata).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export const pbDenomMetadataRequest = hpb.message({
      denom: hpb.string(1).required(),
    });

    export const pbDenomMetadataResponse = hpb.message({
      metadata: hpb.submessage(1, pbMetadata).required(),
    });

    /** @deprecated Use `Cosmos.rpc(network).query(Bank.Query.DenomMetadata, ...)` instead. To be removed in v0.5. */
    export async function getDenomMetadata(network: CosmosNetworkConfig, denom: string) {
      return await Cosmos.rest(network).cosmos.bank.v1beta1.denoms_metadata[denom]('GET');
    }

    export namespace DenomsMetadata {
      export const path = '/cosmos.bank.v1beta1.Query/DenomsMetadata';
      export const request = pbDenomsMetadataRequest;
      export const response = pbDenomsMetadataResponse;
    }
    assertABCIQuery(DenomsMetadata);

    /** Query the metadata for a given denom.
     *
     * **Note:** There is no `DenomMetadataByQuery` ABCI query because it is identical to the
     * `DenomMetadata` query, except it is used by the node to expose the same functionality through
     * the REST API where the denom is passed in as a query parameter.
     */
    export namespace DenomMetadata {
      export const path = '/cosmos.bank.v1beta1.Query/DenomMetadata';
      export const request = pbDenomMetadataRequest;
      export const response = pbDenomMetadataResponse;
    }
    assertABCIQuery(DenomMetadata);
    //#endregion

    //#region Balance
    export const pbBalanceRequest = hpb.message({
      address: hpb.string(1).required(),
      denom: hpb.string(2).required(),
    });

    export const pbBalanceResponse = hpb.message({
      balance: hpb.submessage(1, pbCoin).required(),
    });

    export const pbAllBalancesRequest = hpb.message({
      address: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
      /** Whether to resolve the denom into a human readable form using its metadata. Added in Cosmos SDK 0.50.0. */
      resolveDenom: hpb.bool(3),
    });

    export const pbAllBalancesResponse = hpb.message({
      balances: hpb.repeated.submessage(1, pbCoin).required(),
      pagination: hpb.submessage(2, pbPageResponse).required(),
    });

    export namespace Balance {
      export const path = '/cosmos.bank.v1beta1.Query/Balance';
      export const request = pbBalanceRequest;
      export const response = pbBalanceResponse;
    }
    assertABCIQuery(Balance);

    export namespace AllBalances {
      export const path = '/cosmos.bank.v1beta1.Query/AllBalances';
      export const request = pbAllBalancesRequest;
      export const response = pbAllBalancesResponse;
    }
    assertABCIQuery(AllBalances);
    //#endregion

    //#region SpendableBalances
    export const pbSpendableBalancesRequest = hpb.message({
      address: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbSpendableBalancesResponse = hpb.message({
      balances: hpb.repeated.submessage(1, pbCoin).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace SpendableBalances {
      export const path = '/cosmos.bank.v1beta1.Query/SpendableBalances';
      export const request = pbSpendableBalancesRequest;
      export const response = pbSpendableBalancesResponse;
    }
    assertABCIQuery(SpendableBalances);
    //#endregion

    //#region SpendableBalanceByDenom
    export const pbSpendableBalanceByDenomRequest = hpb.message({
      address: hpb.string(1).required(),
      denom: hpb.string(2).required(),
    });

    export const pbSpendableBalanceByDenomResponse = hpb.message({
      balance: hpb.submessage(1, pbCoin).required(),
    });

    export namespace SpendableBalanceByDenom {
      export const path = '/cosmos.bank.v1beta1.Query/SpendableBalanceByDenom';
      export const request = pbSpendableBalanceByDenomRequest;
      export const response = pbSpendableBalanceByDenomResponse;
    }
    assertABCIQuery(SpendableBalanceByDenom);
    //#endregion

    //#region TotalSupply
    export const pbTotalSupplyRequest = hpb.message({
      pagination: hpb.submessage(1, pbPageRequest),
    });

    export const pbTotalSupplyResponse = hpb.message({
      supply: hpb.repeated.submessage(1, pbCoin).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace TotalSupply {
      export const path = '/cosmos.bank.v1beta1.Query/TotalSupply';
      export const request = pbTotalSupplyRequest;
      export const response = pbTotalSupplyResponse;
    }
    assertABCIQuery(TotalSupply);
    //#endregion

    //#region SupplyOf
    export const pbSupplyOfRequest = hpb.message({
      denom: hpb.string(1).required(),
    });

    export const pbSupplyOfResponse = hpb.message({
      amount: hpb.submessage(1, pbCoin).required(),
    });

    export namespace SupplyOf {
      export const path = '/cosmos.bank.v1beta1.Query/SupplyOf';
      export const request = pbSupplyOfRequest;
      export const response = pbSupplyOfResponse;
    }
    assertABCIQuery(SupplyOf);
    //#endregion

    //#region SendEnabled (shared type used by Params and SendEnabled query)
    export const pbSendEnabled = hpb.message({
      denom: hpb.string(1).required(),
      enabled: hpb.bool(2).required(),
    });
    //#endregion

    //#region Params
    export const pbParams = hpb.message({
      sendEnabled: hpb.repeated.submessage(1, pbSendEnabled),
      defaultSendEnabled: hpb.bool(2),
    });

    export const pbParamsRequest = hpb.message({});

    export const pbParamsResponse = hpb.message({
      params: hpb.submessage(1, pbParams).required(),
    });

    export namespace Params {
      export const path = '/cosmos.bank.v1beta1.Query/Params';
      export const request = pbParamsRequest;
      export const response = pbParamsResponse;
    }
    assertABCIQuery(Params);
    //#endregion

    //#region DenomMetadataByQueryString
    export const pbDenomMetadataByQueryStringRequest = hpb.message({
      denom: hpb.string(1).required(),
    });

    export const pbDenomMetadataByQueryStringResponse = hpb.message({
      metadata: hpb.submessage(1, pbMetadata).required(),
    });

    /** Query the metadata for a given denom via query string parameter.
     *
     * **Note:** This is identical to `DenomMetadata` query, except it is used by the node
     * to expose the same functionality through the REST API where the denom is passed in
     * as a query parameter instead of a path parameter.
     */
    export namespace DenomMetadataByQueryString {
      export const path = '/cosmos.bank.v1beta1.Query/DenomMetadataByQueryString';
      export const request = pbDenomMetadataByQueryStringRequest;
      export const response = pbDenomMetadataByQueryStringResponse;
    }
    assertABCIQuery(DenomMetadataByQueryString);
    //#endregion

    //#region DenomOwners
    export const pbDenomOwner = hpb.message({
      address: hpb.string(1).required(),
      balance: hpb.submessage(2, pbCoin).required(),
    });

    export const pbDenomOwnersRequest = hpb.message({
      denom: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbDenomOwnersResponse = hpb.message({
      denomOwners: hpb.repeated.submessage(1, pbDenomOwner).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    export namespace DenomOwners {
      export const path = '/cosmos.bank.v1beta1.Query/DenomOwners';
      export const request = pbDenomOwnersRequest;
      export const response = pbDenomOwnersResponse;
    }
    assertABCIQuery(DenomOwners);
    //#endregion

    //#region DenomOwnersByQuery
    export const pbDenomOwnersByQueryRequest = hpb.message({
      denom: hpb.string(1).required(),
      pagination: hpb.submessage(2, pbPageRequest),
    });

    export const pbDenomOwnersByQueryResponse = hpb.message({
      denomOwners: hpb.repeated.submessage(1, pbDenomOwner).required(),
      pagination: hpb.submessage(2, pbPageResponse),
    });

    /** Query for all account addresses that own a particular token denomination via query string.
     *
     * **Note:** This is identical to `DenomOwners` query, except it is used by the node
     * to expose the same functionality through the REST API where the denom is passed in
     * as a query parameter instead of a path parameter.
     */
    export namespace DenomOwnersByQuery {
      export const path = '/cosmos.bank.v1beta1.Query/DenomOwnersByQuery';
      export const request = pbDenomOwnersByQueryRequest;
      export const response = pbDenomOwnersByQueryResponse;
    }
    assertABCIQuery(DenomOwnersByQuery);
    //#endregion

    //#region SendEnabled
    export const pbSendEnabledRequest = hpb.message({
      denoms: hpb.repeated.string(1),
      pagination: hpb.submessage(99, pbPageRequest),
    });

    export const pbSendEnabledResponse = hpb.message({
      sendEnabled: hpb.repeated.submessage(1, pbSendEnabled).required(),
      pagination: hpb.submessage(99, pbPageResponse),
    });

    /** Query for SendEnabled entries.
     *
     * This query only returns denominations that have specific SendEnabled settings.
     * Any denomination that does not have a specific setting will use the default
     * params.default_send_enabled, and will not be returned by this query.
     */
    export namespace SendEnabled {
      export const path = '/cosmos.bank.v1beta1.Query/SendEnabled';
      export const request = pbSendEnabledRequest;
      export const response = pbSendEnabledResponse;
    }
    assertABCIQuery(SendEnabled);
    //#endregion
  }
}
