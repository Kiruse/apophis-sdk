import type { Account, DirectSignerPayload, NetworkConfig } from '@crypto-me/core';
import { KeplrDirectAccount } from './account';
import { KeplrSignerBase } from './signer.base';
import Tx from '@crypto-me/core/tx.js';

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
export const KeplrDirect = new class extends KeplrSignerBase<DirectSignerPayload> {
  readonly type = 'Keplr.Direct';

  account(): Account<Tx<DirectSignerPayload>> {
    return new KeplrDirectAccount();
  }

  tx(body: DirectSignerPayload): Tx<DirectSignerPayload> {
    return new Tx(body);
  }
}
