import { PublicKey } from './crypto/pubkey';
import { type NetworkConfig } from './networks';

const middlewares: Middleware[] = [];

export interface Middleware {
  addresses: MiddlewareAddresses;
}

export interface MiddlewareAddresses {
  alias(address: string): string | undefined;
  resolve(alias: string): string | undefined;
  compute(prefixOrNetwork: NetworkConfig | string, publicKey: PublicKey): string;
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
    for (const cb of this.iterator(this.#extract)) {
      const result = cb(...args);
      if (result) return result;
    }
    throw new MiddlewarePipelineError(`No FIFO middleware handled the call`);
  }

  /** Notify all middlewares with the given arguments. Awaits all middlewares to complete. Uncaught errors are logged to console. */
  async notify(...args: NotifyArgs<KP>): Promise<void> {
    const mws = [...this.iterator(this.#extract)];
    await Promise.all(mws.map(async cb => {
      await cb(...args).catch(console.error);
    }));
  }

  #extract = (mw: MiddlewareImpl) => this.kp.reduce((acc: any, key) => acc?.[key], mw) as MiddlewareImpl;
}

mw.stack = middlewares;
mw.use = (...mws: MiddlewareImpl[]) => middlewares.push(...mws as Middleware[]);

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
