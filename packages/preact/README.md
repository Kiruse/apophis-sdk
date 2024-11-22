# @apophis-sdk/preact
Preact integration of the [Apophis SDK](https://github.com/Kiruse/apophis-sdk) web3 wallet integration framework.

# Installation
Install with your favorite package manager's equivalent of:

```
$ npm i preact @preact/signals @apophis-sdk/core @apophis-sdk/preact
```

Note that Apophis SDK is an ESModule package.

# Usage
Apophis SDK consists of two pieces: *Wallet Integrations* & *Frontend Integrations*. You will need at least one of both. `@apophis-sdk/preact` is a frontend integration for [Preact](https://preactjs.com/).

Generally, components in this package are designed to populate the `signals` object from the `@apophis-sdk/core` package. This package exposes only two read/write signals:

- `signer` exposes the currently active signer, representative of the user. Typically, Dapps are
  built to support one user at a time (e.g. per browser tab). This signal is primarily used in the UI.
  In logic, you will typically need to specify the desired signer directly.
- `network` is used to get the active network. This is primarily used in the UI, but some `Cosmos`
  API logic uses it as fallback value if no `NetworkConfig` was passed.

Various other read-only signals are derived from the above:

- `signDatas` is a `Map<NetworkConfig, SignData>` containing the signing data for all of the networks
  that were `connect`ed to the `signer`.
- `signData` is the signing data for the currently active network.
- `chainId` is the chain ID of the currently active network.
- `address` is the address of the currently active signer & network.
- `bech32Prefix` is the bech32 prefix for the currently active network.

The best use for the `signDatas` signal is to respond to keychain changes (i.e. when the user chooses
a different account within their wallet). Both `signData` & `address` will update when either the
network or the keychain changes.

## Components
There are various components designed to facilitate user interaction & connection to Cosmos wallets:

- `WalletSelector` is an inline component listing your enabled wallets & allowing the user to select
  one. Upon selection, the it will attempt to connect to the wallet. Upon success, it will fill the
  `signals.signer` signal.
- `WalletModal` is a dialog wrapper component around `WalletSelector`.
- `Address` is designed to show & optionally truncate an address. It comes with a built-in copy icon button.
- `UserAddress` is a wrapper around `Address` that will show & automatically update the address when the `signals.signer` changes.
