import { SyncEvent } from '@kiruse/typed-events';
import { NetworkConfig } from './types';

export interface Connection {
  rpc?: string;
  rest?: string;
  ws?: string;
}

const store = new Map<NetworkConfig, Connection>();

export const connections = new class {
  readonly onCreate = SyncEvent<NetworkConfig, Connection>();
  readonly onRead = SyncEvent<{ which: 'rpc' | 'rest' | 'ws', network: NetworkConfig, connection: Connection }, string>();

  get(network: NetworkConfig): Connection {
    if (!store.has(network)) {
      const event = this.onCreate.emit(network, {});
      store.set(network, event.result!);
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

  rest(network: NetworkConfig): string {
    const base = this.get(network);
    const event = this.onRead.emit({ which: 'rest', network, connection: base }, base.rest ?? `https://rest.cosmos.directory/${network.name}`);
    return event.result!;
  }

  rpc(network: NetworkConfig): string {
    const base = this.get(network);
    const event = this.onRead.emit({ which: 'rpc', network, connection: base }, base.rpc ?? `https://rpc.cosmos.directory/${network.name}`);
    return event.result!;
  }

  ws(network: NetworkConfig): string {
    const base = this.get(network);
    const event = this.onRead.emit({ which: 'ws', network, connection: base }, base.ws ?? `wss://rpc.cosmos.directory/${network.name}/websocket`);
    return event.result!;
  }
}
