// Internal helpers
import { AnyTypeUrlSymbol } from './constants';
import type { Any } from './encoding/protobuf/any';

export const isAnyable = <T extends string>(value: any, typeUrl?: T) =>
  typeof value === 'object' && value !== null && (typeUrl ? value[AnyTypeUrlSymbol] === typeUrl : typeof value[AnyTypeUrlSymbol] === 'string');
export const isMarshalledAny = <T extends string>(value: any, typeUrl?: T) =>
  typeof value === 'object' && value !== null && (typeUrl ? value.typeUrl === typeUrl : typeof value.typeUrl === 'string');

export const fromAnyable = <T extends string>(base: any, value: Uint8Array): Any<T> => ({ typeUrl: base[AnyTypeUrlSymbol], value });
export const toAnyable = <T1 extends string, T2>(base: Any<T1>, value: T2): T2 & { [AnyTypeUrlSymbol]: T1 } => ({ [AnyTypeUrlSymbol]: base.typeUrl, ...value });
