import { Asset, NetworkConfig } from './networks';

/** A dummy asset intended for unit testing. Should not be used in production code. */
export const asset: Asset = {
  denom: 'untrn',
  decimals: 6,
  name: 'Neutron',
};

/** A dummy network config intended for unit testing. Should not be used in production code. */
export const network: NetworkConfig = {
  chainId: 'pion-1',
  prettyName: 'Neutron Testnet',
  name: 'neutron-testnet',
  addressPrefix: 'neutron',
  assets: [asset],
  gas: [{
    asset,
    avgPrice: 0.0053,
  }],
};
