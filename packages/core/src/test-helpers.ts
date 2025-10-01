import { FungibleAsset, CosmosNetworkConfig } from './networks.js';

/** A dummy asset intended for unit testing. Should not be used in production code. */
export const asset: FungibleAsset = {
  denom: 'untrn',
  decimals: 6,
  name: 'Neutron',
};

/** A dummy network config intended for unit testing. Should not be used in production code. */
export const network: CosmosNetworkConfig = {
  ecosystem: 'cosmos',
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

export const PION_REST_URL = 'https://rest-falcron.pion-1.ntrn.tech';
export const PION_RPC_URL = 'https://rpc-falcron.pion-1.ntrn.tech';
export const PION_WS_URL = 'wss://rpc-falcron.pion-1.ntrn.tech/websocket';
