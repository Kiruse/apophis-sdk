import { Decimal } from '@kiruse/decimal';

export interface NetworkConfig {
  chainId: string;
  prettyName: string;
  /** The unique registry name. */
  name: string;
  /** Bech32 prefix for addresses. */
  addressPrefix: string;
  /** Optional slip44 coin type for HD wallets. This is only relevant for local signers, not for
   * third party signers like Metamask or Keplr. Local signers are typically used on backends or in
   * tools, but not in the frontend.
   *
   * **Note:** Often, we have heuristics to choose a good default. For example, most Cosmos chains
   * use 118. Some chains like Terra use 330. You may find the coin type in the official
   * [SLIP44 Registry](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) or in the
   * [Cosmos Chain Registry](https://github.com/cosmos/chain-registry).
   * However, the exact coin type only matters when attempting to load the same mnemonic into a
   * different wallet. Thus, when used for local tooling, as long as you're consistent about the
   * coin type, it doesn't actually matter which value you use.
   */
  slip44?: number;
  assets: Asset[];
  /** The default gas price. */
  gas: GasConfig[];
  /** Gas multiplier for estimation. Defaults to 1.2. */
  gasFactor?: number | Decimal;
  /** Optional staking asset. While all Cosmos chains have a staking asset, ThorChain does not allow everybody to participate in it. */
  staking?: Asset;
}

export interface Asset {
  denom: string;
  /** Display name */
  name: string;
  /** Optional CoinGecko ID used by some wallets */
  cgid?: string;
  /** Optional CoinMarketCap ID used by some wallets */
  cmcid?: string;
  /** The number of decimals to use when formatting this asset. Defaults to 6. */
  decimals?: number;
}

export interface GasConfig {
  asset: Asset;
  /** Minimum gas fee (note: not the gas price) */
  minFee?: Decimal | number;
  /** Lowest gas price for the cheapest fee. Defaults to `avgPrice`. */
  lowPrice?: Decimal | number;
  /** Average gas price for the average fee. */
  avgPrice: Decimal | number;
  /** Highest gas price for the highest fee. Defaults to `avgPrice`. */
  highPrice?: Decimal | number;
}
