import type { NetworkConfig } from '@apophis-sdk/core/networks.js';
import type { CosmWasmApi } from './cosmwasm.js';
import { mw } from '@apophis-sdk/core/middleware.js';

declare module '@apophis-sdk/core/middleware.js' {
  interface MiddlewareBeta {
    wasm: MiddlewareBetaWasm;
  }
}

export interface MiddlewareBetaWasm {
  /** Whether the given network supports CosmWasm smart contracts at all. Currently, the default
   * implementation simply assumes it does.
   */
  enabled(network: NetworkConfig): boolean;
  /** `notifySync` middleware method for the creation of a new `CosmWasmApi` instance for a
   * `NetworkConfig`. Can be used to alter the instance before it is used.
   */
  created(instance: CosmWasmApi): void;
}

mw.use({
  beta: {
    wasm: {
      enabled: () => true,
    },
  },
});
