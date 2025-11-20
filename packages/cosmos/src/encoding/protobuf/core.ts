import hpb, { TransformParameters } from '@kiruse/hiproto';
import { Amino } from '../amino.js';

export const bigintTransform: TransformParameters<string, bigint> = {
  encode: (value) => value.toString(),
  decode: (value) => BigInt(value),
  default: 0n,
};

export const aminoTransform: TransformParameters<any, any> = {
  encode: value => Amino.normalize(value),
  decode: value => value,
  get default() { return null },
};

export const pbCoin = hpb.message({
  denom: hpb.string(1).required(),
  amount: hpb.string(2).required().transform({
    encode: (value) => value.toString(),
    decode: (value) => BigInt(value),
    default: 0n,
  }),
});

export const pbPageRequest = hpb.message({
  key: hpb.bytes(1),
  offset: hpb.uint64(2),
  limit: hpb.uint64(3),
  countTotal: hpb.bool(4),
  reverse: hpb.bool(5),
});

export const pbPageResponse = hpb.message({
  nextKey: hpb.bytes(1),
  total: hpb.uint64(2).required(),
});
