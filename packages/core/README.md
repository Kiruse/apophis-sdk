# @apophis-sdk/core
Apophis SDK is an extensible & malleable framework for building Cosmos blockchain ecosystem Dapps. The core package contains most of the functionality, with other packages providing integrations for different wallets, chains & frontend frameworks. Apophis is built to be a comprehensive SDK for data retrieval; transaction generation, signing & broadcasting; and RPC abstraction.

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core
```

Other packages in this family include:

- [@apophis-sdk/local-signer](https://npmjs.com/package/@apophis-sdk/local-signer) - A local signing provider for the Apophis SDK, intended for backends & tooling.
- [@apophis-sdk/keplr-signer](https://npmjs.com/package/@apophis-sdk/keplr-signer) - [Keplr Wallet](https://keplr.app) integration for the Apophis SDK.
- [@apophis-sdk/preact](https://npmjs.com/package/@apophis-sdk/preact) - A set of utilities & components for building frontend Dapps with [Preact](https://preactjs.org).

I will build more integrations as time permits.

## Usage
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

// NetworkConfig objects should be passed around by reference, i.e. you should not create a new one
// each time you pass it around.
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

  // Txs accept generic `Any` messages. Which messages are available depends entirely on the chain.
  // However, some messages are generic enough that you can use them across many chains, or can be
  // translated easily using middleware.
  const tx = Cosmos.tx([
    new BankSendMsg(
      'neutron12345...',
      'neutron12345...',
      [Cosmos.coin(1n, 'untrn')]
    ).toAny(network),
  ]);

  // You can either `estimateGas` to ask the network for an estimate, or `computeGas` to compute the
  // gas fee from a gas amount + price (stored in the `NetworkConfig` object).
  await tx.estimateGas(network, signals.signer.value!, true);

  // You can only sign a transaction with a gas configuration.
  await signer.sign(network, tx);

  // You can only broadcast a signed transaction.
  await tx.broadcast();
}
```

## Caveats
- Indicated by its version, *Apophis* is currently in a very early stage and the exposed API may change significantly.
- Not all chains are currently supported. Particularly, chains that extensively modify the baseline Cosmos SDK types such as Injective.
- *Apophis* SDK currently only supports so-called Direct Signing, meaning it currently does not support Amino Signing which is required for Ledger. Amino signing is considered deprecated, and thus does not enjoy my high priority.
