import { NetworkConfig } from './types';
import { mw } from './middleware';

export interface Connection {
  rpc?: string;
  rest?: string;
  ws?: string;
}

const store = new Map<NetworkConfig, Connection>();

export const connections = new class {
  get(network: NetworkConfig): Connection {
    if (!store.has(network)) {
      store.set(network, {});
    }
    return store.get(network)!;
  }

  setRest(network: NetworkConfig, rest: string) {
    this.get(network).rest = rest;
    return this;
  }

  setRpc(network: NetworkConfig, rpc: string) {
    this.get(network).rpc = rpc;
    return this;
  }

  setWs(network: NetworkConfig, ws: string) {
    this.get(network).ws = ws;
    return this;
  }

  rest = (network: NetworkConfig) => mw('connection', 'endpoint').inv().fifo(network, 'rest');
  rpc = (network: NetworkConfig) => mw('connection', 'endpoint').inv().fifo(network, 'rpc');
  ws = (network: NetworkConfig) => mw('connection', 'endpoint').inv().fifo(network, 'ws');
}

mw.use({
  connection: {
    endpoint(network: NetworkConfig, which: 'rest' | 'rpc' | 'ws'): string[] | undefined {
      if (store.has(network)) return [store.get(network)![which]!];
      switch (which) {
        case 'rest': return network.endpoints?.rest ?? [`https://rest.cosmos.directory/${network.name}`];
        case 'rpc': return network.endpoints?.rpc ?? [`https://rpc.cosmos.directory/${network.name}`];
        case 'ws':
          if (network.endpoints?.ws?.length) return network.endpoints.ws;
          throw new Error('cosmos.directory does not support WebSocket endpoints');
      }
    },
  },
});
