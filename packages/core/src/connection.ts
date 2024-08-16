import { Ecosystem, Unregistered } from './constants';
import { NetworkConfig } from './types';

const rpcs: Record<string, string> = {};
const rests: Record<string, string> = {};
const wss: Record<string, string> = {};

export function setRpc(network: NetworkConfig, rpc: string): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  rpcs[network.name] = rpc;
}

export function setRest(network: NetworkConfig, rpc: string): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  rests[network.name] = rpc;
}

export function setWebSocketEndpoint(network: NetworkConfig, ws: string): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  wss[network.name] = ws;
}

export function clearRpc(network: NetworkConfig): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  delete rpcs[network.name];
}

export function clearRest(network: NetworkConfig): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  delete rests[network.name];
}

export function clearWebSocketEndpoint(network: NetworkConfig): void {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  delete wss[network.name];
}

export function getRpc(network: NetworkConfig): string | undefined {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  if (rpcs[network.name]) return rpcs[network.name];
  switch (network.eco) {
    case Ecosystem.Cosmos:
      return `https://rpc.cosmos.directory/${network.name}`;
    default:
      throw new Error('No known default RPC API for this network');
  }
}

export function getRest(network: NetworkConfig): string | undefined {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  if (rests[network.name]) return rests[network.name];
  switch (network.eco) {
    case Ecosystem.Cosmos:
      return `https://rest.cosmos.directory/${network.name}`;
    default:
      throw new Error('No known default REST API for this network');
  }
}

export function getWebSocketEndpoint(network: NetworkConfig): string | undefined {
  if (network.name === Unregistered)
    throw new Error('Unregistered network, please assign a custom name');
  if (wss[network.name]) return wss[network.name];
  switch (network.eco) {
    default:
      throw new Error('No known default WebSocket endpoint for this network');
  }
}
