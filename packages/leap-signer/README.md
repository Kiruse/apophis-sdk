# @apophis-sdk/leap-signer
[Leap](https://leapwallet.io) integration for the [Apophis Web3 SDK](../../README.md).

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/cosmos @apophis-sdk/leap-signer
```

This package is also bundled in the `@apophis-sdk/cosmos-signers` package. You will likely also want to install a frontend integration such as [@apophis-sdk/preact](../preact/README.md).

## Usage
Using a proper frontend integration, usage is simple:

```typescript
import { signals, Signer, type NetworkConfig } from '@apophis-sdk/core';
import { Bank, Cosmos } from '@apophis-sdk/cosmos';
import { Leap } from '@apophis-sdk/cosmos-signers';
import { WalletModal } from '@apophis-sdk/preact';
import { render } from 'preact';

Signer.register(Leap);

const network = await Cosmos.getNetworkFromRegistry('neutrontestnet');

// set active network
signals.network.value ??= network;

// render a `WalletSelector` or `WalletModal`
render((
  <div>
    <UserAddress />
    {!signals.account.value && <WalletModal />}
    <button onClick={handleClick}>Click me!</button>
  </div>
), document.getElementById('app')!);

function handleClick() {
  if (!signals.signer.value || !signals.network.value) return;
  const network = signals.network.value;
  const signer = signals.signer.value; // agnostic of signer implementation
  const tx = signer.tx([
    new Bank.Send({
      fromAddress: signer.address(network),
      toAddress: signer.address(network),
      amount: [Cosmos.coin(1_000000n, 'untrn')], // 1 $NTRN
    })
  ]);

  await tx.estimateGas(network, signer, true);
  await tx.sign(network, signer);
  await tx.broadcast(); // signer & network are stored internally when signed successfully
}
```

## License
[LGPL-3.0](../../LICENSE)
