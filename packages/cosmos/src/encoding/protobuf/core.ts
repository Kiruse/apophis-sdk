import hpb, { TransformParameters } from '@kiruse/hiproto';
import { Amino } from '../amino.js';
import { fromBase64, toBase64 } from '@apophis-sdk/core/utils.js';
import { Bytes, Bytes as HpbBytes } from '@kiruse/hiproto/protobuffer';

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

export const b64Transform: TransformParameters<Bytes | Uint8Array | undefined, string> = {
  encode: (value) => fromBase64(value),
  decode: (value) => toBase64(HpbBytes.getUint8Array(value)),
  default: '',
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
  key: hpb.bytes(1).transform(b64Transform),
  offset: hpb.uint64(2),
  limit: hpb.uint64(3),
  countTotal: hpb.bool(4),
  reverse: hpb.bool(5),
});

export const pbPageResponse = hpb.message({
  nextKey: hpb.bytes(1).transform(b64Transform),
  total: hpb.uint64(2).required(),
});
