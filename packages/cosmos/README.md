# @apophis-sdk/cosmos
Cosmos ecosystem support for the Apophis SDK. Apophis is a strongly opinionated SDK for building web3 applications in different ecosystems.

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/cosmos @apophis-sdk/cosmwasm
```

The `cosmwasm` module is of course not required if the chain doesn't support CosmWasm, but most chains do. EVM support for chains like Injective, Sei or Canto is not yet implemented.

## Usage
```typescript
import { Apophis, Bank, Cosmos, DefaultCosmosMiddlewares, LocalSigner } from '@apophis-sdk/cosmos';

Apophis.use(DefaultCosmosMiddlewares);

const network = await Cosmos.getNetworkFromRegistry('neutrontestnet');
const signer = LocalSigner.fromMnemonic('...');

await Cosmos.ws(network).ready();

const { block } = await Cosmos.ws(network).getBlock();
console.log(block.header.hash, block.header.height, block.header.timestamp);

const tx = Cosmos.tx([
  new Bank.Send({
    fromAddress: signer.address(network),
    toAddress: signer.address(network),
    amount: [Cosmos.coin(1_000000n, 'untrn')],
  }),
]);

// true populates the `gas` field of the `tx` object
await tx.estimateGas(network, signer, true);
await signer.sign(network, tx);
const txhash = await tx.broadcast();
console.log(tx.status);

if (tx.status === 'success') {
  const result = await Cosmos.ws(network).expectTx(tx);
  console.log(result);
}
```

Check out the [Apophis SDK GitBook](https://kirudev-oss.gitbook.io/apophis-sdk/) for more information.

# License
[LGPL-3.0](../../LICENSE)
