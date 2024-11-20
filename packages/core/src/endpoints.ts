import { NetworkConfig } from './types';
import { mw } from './middleware';
import { CosmosNetworkConfig, SolanaNetworkConfig } from './networks';

export type BaseEndpoint = 'rpc';
export type CosmosEndpoint = BaseEndpoint | 'rest' | 'ws';
export type SolanaEndpoint = BaseEndpoint;

export type Endpoints<T extends string = 'rpc'> = {
  [K in T]?: string[];
};

export type GenericEndpoints = Endpoints<string>;
export type CosmosEndpoints = Endpoints<CosmosEndpoint>;
export type SolanaEndpoints = Endpoints<SolanaEndpoint>;

export const endpoints = new class {
  /** Get the endpoint to use for a given network & endpoint type. */
  get(network: SolanaNetworkConfig, which: SolanaEndpoint): string;
  get(network: CosmosNetworkConfig, which: CosmosEndpoint): string;
  get(network: NetworkConfig, which: string): string {
    return mw('endpoints', 'get').inv().fifo(network, which);
  }

  /** Get all endpoints for a given network & endpoint type. */
  list(network: SolanaNetworkConfig, which: SolanaEndpoint): string[];
  list(network: CosmosNetworkConfig, which: CosmosEndpoint): string[];
  list(network: NetworkConfig, which: string): string[] {
    return mw('endpoints', 'list').inv().fifo(network, which);
  }
}
