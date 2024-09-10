# Apophis SDK
Apohis SDK is a Work-in-Progress, extensible Cosmos blockchain Dapp SDK, designed to be a frontend-agnostic one-stop shop for Dapp developers. At this stage, only an integration for Preact exists, though I am still actively working on the SDK and will be adding more integrations as I go.

Apophis SDK is named after [the near-Earth asteroid 99942 Apophis](https://en.wikipedia.org/wiki/99942_Apophis), the obscure interloper of the Sol system.

# Install
Install with your favorite package manager. There are various packages you will need to install. For example:

```bash
npm install @apophis-sdk/core @apophis-sdk/preact @apophis-sdk/keplr-signer
```

The following packages exist:

- `@apophis-sdk/core`
- `@apophis-sdk/preact`
- `@apophis-sdk/keplr-signer`

Further integrations are planned.

# Usage
```typescript
import { Any, type Asset, Cosmos, type NetworkConfig, signals } from '@apophis-sdk/core';
import { SendMessage } from '@apophis-sdk/core/msg/bank';
import { UserAddress, WalletModal } from '@apophis-sdk/preact';
import { render } from 'preact';
import '@apophis-sdk/keplr-signer';

const assets = {
  ntrn: {
    denom: 'untrn',
    name: 'Neutron',
    cgid: 'neutron',
    decimals: 6,
  },
} satisfies Record<string, Asset>;

const network: NetworkConfig = {
  name: 'neutron',
  chainId: 'neutron-1',
  prettyName: 'Neutron',
  addressPrefix: 'neutron',
  slip44: 118,
  assets: [assets.ntrn],
  gas: [{
    asset: assets.ntrn,
    avgPrice: 0.0053,
  }],
};

render((
  <div>
    <UserAddress />
    {!signals.account.value && <WalletModal />}
    <button onClick={handleClick}>Click me!</button>
  </div>
), document.getElementById('app')!);

function handleClick() {
  const signer = signals.signer.value;
  if (!signer) {
    console.log('No signer chosen');
    return;
  }

  const tx = Cosmos.tx([
    Any.encode(new SendMessage(
      'neutron12345...',
      'neutron12345...',
      [Cosmos.coin(1n, 'untrn')]
    )),
  ]);
  await tx.estimateGas(network, signals.signer.value!, true);
  await signer.sign(network, tx);
  await tx.broadcast();
}
```

## Networks & API Connections
The Cosmos is multichain. Thus, Apophis SDK is designed to be multichain. When working with Apophis, you will typically define `NetworkConfig` objects and pass these objects around. In part, objects are used as keys in `Map`s and thus should not be constructed on-the-fly.

`@apophis-sdk/core/connections.js` exposes various methods for retrieving endpoints for a given `NetworkConfig`. These include `getRPC`, `getREST` & `getWebSocketEndpoint` methods, as well as corresponding `set` methods.

The default RPC & REST endpoints rely on the proxy provided by [cosmos.directory](https://cosmos.directory). For WebSockets, you will need to configure these manually.

# License
Apophis SDK is licensed under **LGPL-3.0**.
