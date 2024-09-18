# @apophis-sdk/leap-signer
[Leap](https://leapwallet.io) integration for the [Apophis Cosmos SDK](../../README.md).

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/leap-signer
```

You will likely also want to install a frontend integration such as [@apophis-sdk/preact](../preact/README.md).

## Usage
Using a proper frontend integration, usage is simple:

```typescript
import { Any, signals, signers, type Asset, type NetworkConfig } from '@apophis-sdk/core';
import { WalletModal } from '@apophis-sdk/preact';
import { LeapDirect } from '@apophis-sdk/leap-signer';
import { render } from 'preact';

signers.push(LeapDirect);

const assets: Record<string, Asset> = /* your assets here */;
const network: Record<string, NetworkConfig> = /* your network config here */;
const networks = Object.values(network);

signals.network.value ??= /* your network config here */;

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
    Any.encode(/* your message here */),
  ]);

  await tx.estimateGas(network, signer, true);
  await tx.sign(network, signer);
  await tx.broadcast(); // signer & network are stored internally when signed successfully
}
```

