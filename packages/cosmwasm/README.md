# @apophis-sdk/cosmwasm
CosmWasm integration for the Apophis SDK. This integration builds upon the Cosmos SDK integration, adding support for CosmWasm smart contracts. Similar to the Cosmos integration which exports the `Cosmos` API object, this package exports the `CosmWasm` API object.

Note that this API will likely change in the future.

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/cosmos @apophis-sdk/cosmwasm
```

## Usage
```typescript
import { Cosmos, LocalSigner, mw } from '@apophis-sdk/cosmos';
import { CosmWasm, DefaultCosmWasmMiddlewares } from '@apophis-sdk/cosmwasm';

mw.use(DefaultCosmWasmMiddlewares); // includes `DefaultCosmosMiddlewares`

const network = await Cosmos.getNetworkFromRegistry('neutrontestnet');
const signer = LocalSigner.fromMnemonic('...');

await Cosmos.ws(network).ready();

const response = await CosmWasm.query.smart({
  network,
  'neutron1...', // contract address
  // smart query messages are only JSON-formatted by convention, not by requirement
  // toBinary is a helper to serialize JSON messages
  // it's really just implemented using `TextEncoder`, `JSON`, and a marshaller
  CosmWasm.toBinary({
    config: {},
  }),
});
console.log(response);

await CosmWasm.execute(
  network,
  signer,
  'neutron1...', // contract address
  // same JSON convention here
  CosmWasm.toBinary({
    increment: {},
  }),
  [Cosmos.coin(1_000000n, 'untrn')], // optional native coin "funds" to pass along the call
);
```

Check out the [Apophis SDK GitBook](https://kirudev-oss.gitbook.io/apophis-sdk/) for more information.

# License
[LGPL-3.0](../../LICENSE)
