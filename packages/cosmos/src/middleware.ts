import { DefaultMiddlewares } from '@apophis-sdk/core';
import type { CosmosEndpoint, CosmosEndpoints, CosmosNetworkConfig } from '@apophis-sdk/core';
import type { MiddlewareImpl } from '@apophis-sdk/core/middleware.js';
import { CosmosPubkeyMiddleware } from './crypto/pubkey';
import { AminoMiddleware } from './encoding/amino';

const store = new Map<CosmosNetworkConfig, CosmosEndpoints>();

export function setEndpoints(network: CosmosNetworkConfig, endpoints: CosmosEndpoints) {
  store.set(network, endpoints);
}

export function setEndpoint(network: CosmosNetworkConfig, which: CosmosEndpoint, value: string) {
  const endpoints = store.get(network) ?? {};
  if (!endpoints[which]) endpoints[which] = [];
  endpoints[which].push(value);
  store.set(network, endpoints);
}

export const CosmosMiddleware: MiddlewareImpl = {
  endpoints: { get, list },
};

export const DefaultCosmosMiddlewares = [
  ...DefaultMiddlewares,
  CosmosMiddleware,
  CosmosPubkeyMiddleware,
  AminoMiddleware,
];

function get(network: CosmosNetworkConfig, which: CosmosEndpoint): string | undefined {
  return list(network, which)?.[0];
}

function list(network: CosmosNetworkConfig, which: CosmosEndpoint): string[] | undefined {
  if (network.ecosystem !== 'cosmos') return undefined;

  const stored = store.get(network)?.[which];
  if (stored?.length) return stored;

  if (network.endpoints?.[which]?.length) return network.endpoints[which];

  switch (which) {
    case 'rest': return [`https://rest.cosmos.directory/${network.name}`];
    case 'rpc': return [`https://rpc.cosmos.directory/${network.name}`];
    // ws is not supported through the directory
  }
}
