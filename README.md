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

## API
Apophis SDK is designed to be a one-stop shop for all your Cosmos Dapp & tooling needs. The `Cosmos` object is your swiss army knife of blockchain interaction. The object itself exposes various general purpose methods such as `findBlockAt`, `tx`, `coin`, `getTxHash`, and `decodeTx`. But it also exposes the underlying REST & WebSocket API clients which you can use to access the full functionality of the blockchain, albeit partially undocumented.

### REST API
Apophis uses my [@kiruse/restful](https://github.com/kiruse/restful.ts) library to provide an easily-configurable REST API for all networks. It currently only supports one API definition for all networks, but this will change in the future.

The REST API is exposed by the `rest` property of the `Cosmos` object. It closely mimics the REST API of blockchains. Due to how *restful.ts* is built, it supports literally all endpoints - it just doesn't know it yet. If you need access to an endpoint that isn't documented or has been overridden by a specific network, you can simply change `Cosmos.rest(network) as any` and call the endpoint following the same pattern.

```typescript
import { Cosmos } from '@apophis-sdk/core';
import { network } from '@apophis-sdk/core/test-helpers.js';

// GET signatures are <endpoint>('GET', <options?>) with `params` corresponding to the query parameters of the endpoint
const account = await Cosmos.rest(network).cosmos.auth.v1beta1.account_info('GET');
const balances = await Cosmos.rest(network).cosmos.bank.v1beta1.balances['neutron1...']('GET', { params: { resolve_denom: true }});
const { block } = await Cosmos.rest(network).cosmos.tendermint.v1beta1.blocks.latest('GET');

const tx = Cosmos.tx([/* ... */]);
// POST signature is <endpoint>('POST', <unserialized body>, <options?>)
await Cosmos.rest(network).cosmos.tx.v1beta1.simulate('POST', { tx_bytes: tx.signBytes() });

// ...
```

However, before using the REST API, you may want to check the other available methods on the `Cosmos` object first.

## Transactions
We distinguish between two types of transaction types: `CosmosTransaction`, which is a finalized transaction directly corresponding to the Cosmos SDK's `Tx` type, and `Tx`, which is Apophis SDK's abstraction interface to facilitate building, signing & broadcasting transactions.

```typescript
import { Cosmos } from '@apophis-sdk/core';
import { LocalSigner } from '@apophis-sdk/local-signer';
import { network } from '@apophis-sdk/core/test-helpers.js';

const signer = LocalSigner.fromMnemonic('...');

const tx = new Cosmos.tx([
  new BankSendMsg(/* ... */).toAny(network),
]);

await tx.estimateGas(network, signer, true);
await signer.sign(network, tx);
await tx.broadcast();
```

It's that easy.

## WebSocket API
The WebSocket API is more limited than the REST API, but really well suited for searching specific transactions or building an indexer. Apophis abstracts WebSocket connections to make it incredibly easy to maintain an active connection with subscriptions:

```typescript
import { connections, Cosmos } from '@apophis-sdk/core';
import { TendermintQuery } from '@apophis-sdk/core/query.js';
import { network } from '@apophis-sdk/core/test-helpers.js';

// configure the connection. most nodes listed in the chain registry expose the websocket endpoint, e.g.
// eventually, we will support multiple endpoints for the sake of fault tolerance
connections.setRpc(network, 'wss://rpc-falcron.pion-1.ntrn.tech/websocket');

// monitor incoming bank transfers on your address
let query = new TendermintQuery().exact('transfer.recipient', 'neutron1...');
Cosmos.ws(network).onTx(query, (tx) => {
  console.log(tx);
});

// listen for new blocks
Cosmos.ws(network).onBlock((block) => {
  console.log(block);
});

await Cosmos.ws(network).ready();

// when all else fails, you can always send raw requests
const response = await Cosmos.ws(network).send('method...', [param1, param2, ...]);

// and you can always intercept messages on the underlying protocol
Cosmos.ws(network).socket.onMessage((message) => {
  console.log(message);
});

// or listen to the disconnect/reconnect events
Cosmos.ws(network).socket.onConnect(() => {
  // this event is always fired even when reconnecting
  console.log(`Connected to ${network.prettyName}`);
});
Cosmos.ws(network).socket.onDisconnect(() => {
  console.log(`Disconnected from ${network.prettyName}`);
});
Cosmos.ws(network).socket.onReconnect(() => {
  // this event is only fired when the socket is disconnected and automatically reconnected
  console.log(`Reconnected to ${network.prettyName}`);
});
Cosmos.ws(network).socket.onClose(() => {
  // this event is only fired when the socket is `.close()`d, not when it is disconnected e.g. due to network issues
  console.log(`Closed connection to ${network.prettyName}`);
});
```

The browser-built-in WebSocket API is highly generic and requires a lot of state management & error handling. Apophis does this for you. For example, it automatically reconnects, sends heartbeats & manages your subscriptions.

# License
Apophis SDK is licensed under **LGPL-3.0**.
