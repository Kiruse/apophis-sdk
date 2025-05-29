import hpb, { TransformParameters } from '@kiruse/hiproto';
import { Amino } from '../amino';

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
