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
- `@apophis-sdk/leap-signer`
- `@apophis-sdk/local-signer`
- `@apophis-sdk/walletconnect-signer`

Further integrations are planned.

# Usage
```typescript
import { Any, type Asset, Cosmos, type NetworkConfig, signers, signals } from '@apophis-sdk/core';
import { BankSendMsg } from '@apophis-sdk/core/msg/bank';
import { KeplrDirect } from '@apophis-sdk/keplr-signer';
import { UserAddress, WalletModal } from '@apophis-sdk/preact';
import { render } from 'preact';

// signers are shown by `WalletSelector` and `WalletModal` components
signers.push(KeplrDirect);

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
    new BankSendMsg(
      'neutron12345...',
      'neutron12345...',
      [Cosmos.coin(1n, 'untrn')]
    ).toAny(network),
  ]);
  await tx.estimateGas(network, signals.signer.value!, true);
  await signer.sign(network, tx);
  await tx.broadcast();
}
```

## Networks & API Connections
The Cosmos is multichain. Thus, Apophis SDK is designed to be multichain. When working with Apophis, you will typically define `NetworkConfig` objects and pass these objects around. In part, objects are used as keys in `Map`s and thus should not be constructed on-the-fly.

`@apophis-sdk/core/connections.js` exposes the `connections` object, which you can use to get & set RPC, REST & WebSocket endpoints for a given `NetworkConfig`. Default endpoints rely on [cosmos.directory](https://cosmos.directory).

`connections` has two events, `onCreate` & `onRead`, which you can use to alter the behavior. For example:

```typescript
// override neutron-testnet with new default endpoints
connections.onCreate((event, network) => {
  if (network.name === 'neutron-testnet') {
    // this is a `Connection` object
    event.result!.rest ??= 'https://rest-falcron.pion-1.ntrn.tech';
    event.result!.rpc ??= 'https://rpc-falcron.pion-1.ntrn.tech';
    event.result!.ws ??= 'wss://ws-falcron.pion-1.ntrn.tech/websocket';
  }
});

const localNetworks = ['neutron', 'neutron-testnet', 'cosmoshub', 'cosmoshub-testnet'];

connections.onRead((event, { which, network, config }) => {
  // override locally hosted networks with localhost
  if (localNetworks.includes(network.name)) {
    switch (which) {
      case 'rest':
        event.result = 'http://localhost:1337';
        break;
      case 'rpc':
        event.result = 'http://localhost:26657';
        break;
      case 'ws':
        event.result = 'ws://localhost:26657/websocket';
        break;
    }
  }
});
```

# License
Apophis SDK is licensed under **LGPL-3.0**.
