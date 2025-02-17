import { PublicKey } from './crypto/pubkey.js';
import { type Any } from './encoding/protobuf/any.js';
import { CosmosEndpoint, SolanaEndpoint } from './endpoints.js';
import { CosmosNetworkConfig, SolanaNetworkConfig, type NetworkConfig } from './networks.js';

const middlewares: Middleware[] = [];

export interface Middleware {
  addresses: MiddlewareAddresses;
  beta: MiddlewareBeta;
  /** `endpoints` middleware for retrieving & listing endpoints for a network. */
  endpoints: MiddlewareEndpoints;
  encoding: MiddlewareEncoding;
}

export interface MiddlewareAddresses {
  alias(address: string): string | undefined;
  resolve(alias: string): string | undefined;
  compute(network: NetworkConfig, publicKey: PublicKey): string;
}

export interface MiddlewareBeta {}

export interface MiddlewareEndpoints {
  /** `inv().fifo` middleware for retrieving an endpoint from a network's endpoints backends, called by
   * `endpoints.get`.
   */
  get(network: CosmosNetworkConfig, which: CosmosEndpoint): string;
  get(network: SolanaNetworkConfig, which: SolanaEndpoint): string;
  get(network: NetworkConfig, which: string): string;

  /** `inv().fifo` middleware for listing all endpoints for a network, called by `endpoints.list`. */
  list(network: CosmosNetworkConfig, which: CosmosEndpoint): string[];
  list(network: SolanaNetworkConfig, which: SolanaEndpoint): string[];
  list(network: NetworkConfig, which: string): string[];
}

/** Middleware for encoding & decoding values. */
export interface MiddlewareEncoding {
  encode(network: NetworkConfig, encoding: string, value: unknown): unknown;
  decode(network: NetworkConfig, encoding: string, value: unknown): unknown;
}

export type MiddlewareImpl = DeepPartial<Middleware>;

type Defined<T> = T extends undefined | null ? never : T;
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

type Lens<T, K extends string[]> =
  K extends [] ? T
  : K extends [infer First extends keyof T, ...infer Rest extends string[]]
    ? Rest extends []
      ? T[First]
      : Lens<T[First], Rest>
    : never;

type Transformer<T> = (arg: T) => T;
type TransformType<K extends string[]> = Lens<Middleware, K> extends Transformer<infer T> ? T : never;

type FifoArgs<K extends string[]> = Lens<Middleware, K> extends (...args: infer A) => any ? A : never;
type FifoResult<K extends string[]> = Lens<Middleware, K> extends (...args: any[]) => infer R ? R : never;

type NotifyArgs<K extends string[]> = Lens<Middleware, K> extends (...args: infer A) => void | Promise<void> ? A : never;
type NotifySyncArgs<K extends string[]> = Lens<Middleware, K> extends (...args: infer A) => void ? A : never;

export function mw<KP extends string[], KN extends string & keyof Lens<Middleware, KP>>(..._keypath: KP | [...KP, KN]) {
  return new MiddlewarePipeline<[...KP, KN]>(_keypath, forwardIterator);
}

class MiddlewarePipeline<KP extends string[]> {
  inv = () => new MiddlewarePipeline<KP>(this.kp, backwardIterator);

  constructor(private readonly kp: string[], private readonly iterator: (extract: (mw: MiddlewareImpl) => any) => Iterable<Function>) {}

  /** Call the middlewares with the given argument, passing the result of the previous middleware to the next.
   * If no middleware handles the call, the original argument is returned.
   */
  transform(arg: TransformType<KP>): TransformType<KP> {
    for (const cb of this.iterator(this.#extract)) {
      arg = cb(arg);
    }
    return arg;
  }

  /** Call the middlewares with the given arguments, returning the first that returns a non-undefined value.
   * If no middleware handles the call, throws a `MiddlewarePipelineError`.
   */
  fifo(...args: FifoArgs<KP>): Defined<FifoResult<KP>> {
    const result = this.fifoMaybe(...args);
    if (!result) throw new MiddlewarePipelineError(`No FIFO middleware handled the call`);
    return result;
  }

  /** Call the middlewares with the given arguments, returning the first that returns a non-undefined value.
   * If no middleware handles the call, returns `undefined`.
   */
  fifoMaybe(...args: FifoArgs<KP>): Defined<FifoResult<KP>> | undefined {
    for (const cb of this.iterator(this.#extract)) {
      const result = cb(...args);
      if (result) return result;
    }
  }

  /** Notify all middlewares with the given arguments. Awaits all middlewares to complete. Uncaught errors are logged to console. */
  async notify(...args: NotifyArgs<KP>): Promise<void> {
    const mws = [...this.iterator(this.#extract)];
    await Promise.all(mws.map(async cb => {
      await cb(...args).catch(console.error);
    }));
  }

  /** Notify all middlewares with the given arguments. Middlewares must be synchronous. Uncaught errors are logged to console. */
  notifySync(...args: NotifySyncArgs<KP>): void {
    const mws = [...this.iterator(this.#extract)];
    for (const cb of mws) {
      try {
        cb(...args);
      } catch (e) {
        console.error('Error during middleware notify (sync):', e);
      }
    }
  }

  /** Call the middlewares with the given arguments, reducing the result of each middleware with the given reducer. */
  reduce(args: any[], reducer: (result: any, response: any) => any, initial: any) {
    let result = initial;
    for (const cb of this.iterator(this.#extract)) {
      result = reducer(result, cb(...args));
    }
    return result;
  }

  #extract = (mw: MiddlewareImpl) => this.kp.reduce((acc: any, key) => acc?.[key], mw) as MiddlewareImpl;
}

mw.stack = middlewares;
mw.use = (...mws: MiddlewareImpl[]) => {
  middlewares.push(...mws as Middleware[]);
  return () => {
    for (const curr of mws) {
      const index = middlewares.indexOf(curr as Middleware);
      if (index !== -1) middlewares.splice(index, 1);
    }
  };
};

function* forwardIterator(extract: (mw: MiddlewareImpl) => any) {
  for (const mw of middlewares) {
    const cb = extract(mw);
    if (typeof cb !== 'function') continue;
    yield cb;
  }
}

function* backwardIterator(extract: (mw: MiddlewareImpl) => any) {
  for (const mw of [...middlewares].reverse()) {
    const cb = extract(mw);
    if (typeof cb !== 'function') continue;
    yield cb;
  }
}

export class MiddlewarePipelineError extends Error {}
