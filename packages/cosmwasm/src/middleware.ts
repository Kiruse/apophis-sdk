import { MiddlewareImpl } from '@apophis-sdk/core/middleware.js';
import type { NetworkConfig } from '@apophis-sdk/core/networks.js';
import { DefaultCosmosMiddlewares } from '@apophis-sdk/cosmos';
import type { CosmWasmApi } from './cosmwasm.js';

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

export const CosmWasmMiddleware: MiddlewareImpl = {
  beta: {
    wasm: {
      enabled: () => true,
    },
  },
};

export const DefaultCosmWasmMiddlewares = [
  ...DefaultCosmosMiddlewares,
  CosmWasmMiddleware,
];
