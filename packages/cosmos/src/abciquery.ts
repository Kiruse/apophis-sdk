import type { IMessage } from '@kiruse/hiproto/message';

/** An auxiliary type used to define the request & response protobuf types for a generic Tendermint
 * ABCI query.
 */
export interface ABCIQuery<T1 extends string = string, T2 = any, T3 = any> {
  readonly path: T1;
  readonly request: IMessage<any, T2>;
  readonly response: IMessage<any,T3>;
}

export const isABCIQuery = (value: any): value is ABCIQuery =>
  typeof value === 'object' && value !== null && 'abciPath' in value && 'abciRequest' in value && 'abciResponse' in value;

/** Virtual type-only method asserting that a type is a valid ABCIQuery. */
export function assertABCIQuery(_: ABCIQuery) {}
