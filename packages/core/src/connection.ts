import { NetworkConfig } from './types';

const rpcs: Record<string, string> = {};
const rests: Record<string, string> = {};
const wss: Record<string, string> = {};

export function setRpc(network: NetworkConfig, rpc: string): void {
  rpcs[network.name] = rpc;
}

export function setRest(network: NetworkConfig, rpc: string): void {
  rests[network.name] = rpc;
}

export function setWebSocketEndpoint(network: NetworkConfig, ws: string): void {
  wss[network.name] = ws;
}

export function clearRpc(network: NetworkConfig): void {
  delete rpcs[network.name];
}

export function clearRest(network: NetworkConfig): void {
  delete rests[network.name];
}

export function clearWebSocketEndpoint(network: NetworkConfig): void {
  delete wss[network.name];
}

export function getRpc(network: NetworkConfig): string | undefined {
  if (rpcs[network.name]) return rpcs[network.name];
  return `https://rpc.cosmos.directory/${network.name}`;
}

export function getRest(network: NetworkConfig): string | undefined {
  if (rests[network.name]) return rests[network.name];
  return `https://rest.cosmos.directory/${network.name}`;
}

export function getWebSocketEndpoint(network: NetworkConfig): string | undefined {
  if (wss[network.name]) return wss[network.name];
  return `wss://rpc.cosmos.directory/${network.name}/websocket`;
}
