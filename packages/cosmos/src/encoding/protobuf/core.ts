import hpb from '@kiruse/hiproto';

export const pbCoin = hpb.message({
  denom: hpb.string(1),
  amount: hpb.string(2).transform({
    encode: (value) => value.toString(),
    decode: (value) => BigInt(value),
    default: 0n,
  }),
});
