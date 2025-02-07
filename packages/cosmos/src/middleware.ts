import { type CosmosEndpoint, type CosmosEndpoints, type CosmosNetworkConfig } from '@apophis-sdk/core';
import { mw } from '@apophis-sdk/core/middleware.js';
import { Amino } from './encoding.js';

declare module '@apophis-sdk/core/middleware.js' {
  interface MiddlewareEncoding {
    amino: MiddlewareAmino;
  }
}

export interface MiddlewareAmino {
  /** `fifo` endpoint to encode the given value, if possible. */
  encode(network: CosmosNetworkConfig, value: unknown): unknown;
  /** `fifo` endpoint to decode the given value, if possible. */
  decode(network: CosmosNetworkConfig, value: unknown): unknown;
}

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

mw.use({
  endpoints: { get, list },
  encoding: {
    amino: { encode: Amino.encode, decode: Amino.decode },
  },
});

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
