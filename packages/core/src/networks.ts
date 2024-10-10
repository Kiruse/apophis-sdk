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
  /** Endpoints to use for this network. If omitted, the default is to use the
   * [cosmos.directory](https://cosmos.directory) load balancer.
   *
   * Note that the `networkFromRegistry` function automatically populates these endpoints from the
   * [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) which is the same data source
   * used by the *cosmos.directory* - however, the *cosmos.directory* does not support WebSockets
   * or testnets, so you will most likely want to populate these values.
   */
  endpoints?: {
    /** The REST endpoints to use. */
    rest?: string[];
    /** The RPC endpoints to use. */
    rpc?: string[];
    /** When omitted, alters the `rpc` endpoints by changing the protocol to `ws(s)` and appending `/websocket`. */
    ws?: string[];
  };
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

export async function networkFromRegistry(name: string): Promise<NetworkConfig> {
  const isTestnet = name.match(/testnet|devnet/);
  const baseurl = isTestnet
    ? `https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/${name}`
    : `https://raw.githubusercontent.com/cosmos/chain-registry/master/${name}`;
  const [chainData, assetlist] = await Promise.all([
    fetch(`${baseurl}/chain.json`).then(res => res.json()),
    fetch(`${baseurl}/assetlist.json`).then(res => res.json()),
  ]);

  const assets: Asset[] = assetlist.assets.map((asset: any): Asset => ({
    denom: asset.base,
    name: asset.name,
    decimals: asset.denom_units.find((unit: any) => unit.denom === asset.display)?.decimals ?? 0,
  }));

  const [feeData] = chainData.fees?.fee_tokens ?? [];
  if (!feeData) throw new Error(`No fee info found in Cosmos Chain Registry for ${name}`);

  const feeAsset = assets.find(asset => asset.denom === feeData.denom);
  if (!feeAsset) throw new Error(`Fee asset ${feeData.denom} not found in asset list for ${name}`);

  return {
    name,
    chainId: chainData.chain_id,
    prettyName: chainData.pretty_name,
    addressPrefix: chainData.bech32_prefix,
    slip44: chainData.slip44,
    assets: assets,
    gas: [{
      asset: feeAsset,
      avgPrice: feeData.average_gas_price,
      lowPrice: feeData.low_gas_price ?? feeData.average_gas_price,
      highPrice: feeData.high_gas_price ?? feeData.average_gas_price,
      minFee: feeData.fixed_min_gas_price,
    }],
    endpoints: {
      rest: chainData.apis?.rest?.map(({ address }: any) => address),
      rpc: chainData.apis?.rpc?.map(({ address }: any) => address),
      ws: chainData.apis?.rpc?.map(({ address }: any) => address).map((ep: string) => ep.replace(/^http/, 'ws').replace(/\/$/, '') + '/websocket'),
    },
  };
}
