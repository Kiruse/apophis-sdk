// This file is kept separately in order to permit for tree-shaking
import { ChainRegistryClient } from '@chain-registry/client';

export async function fetchChains(names: string | string[]) {
  names = Array.isArray(names) ? names : [names];

  const client = new ChainRegistryClient({ chainNames: names });
  await client.fetchUrls();

  return Object.fromEntries(names.map(name =>
    [
      name,
      {
        chain: client.getChain(name),
        assets: client.getChainAssetList(name),
        ibc: client.getChainIbcData(name),
        info: client.getChainInfo(name),
        util: client.getChainUtil(name),
      }
    ]
  ));
}
