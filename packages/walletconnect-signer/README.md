# @apophis-sdk/walletconnect-signer
[WalletConnect](https://walletconnect.network/) integration for the [Apophis Cosmos SDK](../../README.md).

This integration is built on [@reown/appkit](https://www.npmjs.com/package/@reown/appkit) and provides a custom adapter

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/walletconnect-signer
```

You will likely also want to install a frontend integration such as [@apophis-sdk/preact](../preact/README.md).

## Usage
Using a proper frontend integration, usage is simple:

```typescript
import { Any, signals, signers, type Asset, type NetworkConfig } from '@apophis-sdk/core';
import { WalletModal } from '@apophis-sdk/preact';
import { WalletConnectSigner } from '@apophis-sdk/walletconnect-signer';
import { render } from 'preact';

signers.push(WalletConnectSigner);

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
    Any.encode(network, /* your message here */),
  ]);

  await tx.estimateGas(network, signer, true);
  await tx.sign(network, signer);
  await tx.broadcast(); // signer & network are stored internally when signed successfully
}
```
