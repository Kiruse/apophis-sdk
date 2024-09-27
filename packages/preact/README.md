# @apophis-sdk/preact
Preact integration of the [Crypto Me](https://github.com/Kiruse/Apophis SDK) web3 wallet integration framework.

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

# UX Recommendations
Cosmos is a vast & heterogenous ecosystem. Cosmos is also excessively overwhelming for newcomers. I
thus strongly recommend that Dapp designers & developers abstract away the details of Cosmos chains,
and instead of requiring the user to make a conscious decision about which network they intend to
use, you should infer it based on the user's actions & intents.

Think of your Dapp as self-contained. Tackle design from a user's perspective. Imagine the user has
no knowledge of our ecosystem at all. They just want to get something done. For example, simply
sending some funds across chains. Most Dapps first ask you where these funds are coming from. Heck
if I know, I just want to send some $WHALE to my friend! So, let them search for $WHALE instead, and
then let them choose which network they intend to use, showing balances for each. Then, depending
on the recipient's address, extract the Bech32 prefix and find the appropriate network. If multiple,
let them choose. The less the user has to think about their actions, the better.

[In my own project](https://dropnote.io), I infer the network based on the recipient's address. When
selecting a conversation, Dropnote detects the recipient, extracts the Bech32 prefix, and
automatically chooses the first matching network. The network dropdown is now filtered to only show
networks with the detected prefix. In the case of Neutron, this matches Mainnet & Testnet. In the
case of Terra, this would match Mainnet & Classic. When creating a new conversation, the user must
enter the recipient's address, which triggers the same network detection logic.
