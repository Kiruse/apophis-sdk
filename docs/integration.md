# Apophis SDK Integrations
The SDK is still in heavy development. I thus discourage developing custom integrations at this time.

***This document is a work in progress.***

We distinguish between three types of integrations:

1. **Wallet Integrations**
2. **Frontend Integrations**
3. **Chain Integrations**

## Wallet/Signer Integrations
To integrate a new wallet or generic signer, you should extend the `Signer` base abstract class. You may alternatively treat it as an interface and implement it from scratch, though I advise against it.

Most notably, you will need to implement the following methods:

- `probe`: Check whether this wallet is available in the current environment. Generally, the environment will be a browser, though some signers may also be available e.g. in tooling.
- `connect`: Connect to the wallet and prepare it for signing transactions. Most wallets use a permission model where you must explicitly request the user's permission to connect to specific networks.
- `sign`: Sign a `Tx` object. The signature data should be stored within the same `Tx` object and returned.
- `broadcast`: Broadcast a signed transaction. Some wallets may offer this functionality natively, allowing the user to specify their own RPC endpoint. Otherwise, you may use the `@apophis-sdk/core/connection.js` module to broadcast the transaction.
- `getAccounts`: Get the signer's accounts for a given network. While multiple accounts can be returned and tracked here, only the first account will currently be used to sign transactions with.

When implementing the `connect` method, you should call the `_initSignData` method of the base `Signer` abstract class. This method relies on the `getAccounts()` method which you must also implement. This method fetches some additional required data from the network. If you have to or wish to support offline signing, you will need to implement your own `_initSignData` method and track both `sequence` and `accountNumber` yourself.

At the end of the `connect` method, you should also call the `Cosmos.watchSigner(this)` method. While not strictly necessary, this will instruct the SDK to monitor the blockchain for new transactions made by the user and keep their account data in sync. This is particularly useful when the user executes transactions in another Dapp or otherwise outside of your control. It is safe to call `watchSigner` multiple times, it will not interfere with already watched signers.

## Frontend Integrations
Frontends do not have any special requirements. It is, however, advised to incorporate the Apophis SDK's signals into your frontend integration's components. This simplifies deep integration & reactivity throughout the Dapp.

## Chain Integrations
Chain integrations are arguably the most complex type of integration, as they require a deep understanding of the underlying blockchain, and blockchains from different ecosystems are often so different that next to no code can be shared.

To facilitate chain integrations, Apophis SDK defines two core design principles:

1. **You know best.** The SDK employs a hyper-modular architecture, with packages building upon certain other packages. `@apophis-sdk/core` only contains the most basic functionality and shared types, such as Endpoint management, chain distinctions, and common encoding formats. Both you as the integration developer, and the user of the SDK, are required to explicitly know the ecosystem & its intricacies. The SDK does not provide a common basis for all supported blockchains, as this basis would be incredibly small.
2. **Dynamic Middleware.** The SDK's middleware system is extremely flexible. Middleware modules are deeply partial nested collections of methods, and the root `mw` method helps invoking these collections of methods using different invocation strategies.

### Middleware Strategies
First, an example usage of the `mw` method:

```typescript
import { mw } from '@apophis-sdk/core/middleware.js';
const addr = mw('addresses', 'compute').inv().fifo(network, publicKey);
```

In the above code, `mw('addresses', 'compute')` is fully typed and scopes into the appropriate middleware interface. `.inv()` then reverses the middleware iterator, looping over the registered middleware modules in reverse order. `.fifo()` then finally invokes each middleware module's corresponding method one by one with the provided arguments. `fifo` is the invocation strategy, thus indicating that the first middleware module which returns any value that is not `undefined` will be the value returned by the invocation.

There are various invocation strategies:

- `fifo` *"First In, First Out."* The first middleware module that returns a value (that is not `undefined`) will be the value returned by the invocation. Throws a `MiddlewarePipelineError` if no middleware module returns a value.
- `fifoMaybe` - same as `fifo`, but the middleware stack is not required to return a value.
- `transform` - calls each middleware module in turn, passing the result of each middleware to the next. These methods must return the same type than it they take as input. Likewise, the first passed-in value must be of the same type as well. If no middleware module was registered that handles this method, the input value is returned as is. This is effectively a specialization of the `reduce` strategy. It is used, for example, to transform an address into a human-readable alias, respecting different address books.
- `notify` - calls each middleware module, awaiting all to complete. Return values and exceptions are ignored. It is intended to, for example, allow middleware to inject data or additional methods into newly created objects of interest.
- `notifySync` - same as `notify`, but middleware modules must be synchronous.
- `reduce` - calls each middleware module in turn, passing the result of each middleware to the next. The typing for this strategy is currently broken and uses `any` - use at your own risk.

Default behavior is typically the first registered middleware module, thus, typically, you will want to `.inv()` the middleware stack first.

### Extending Middleware
The Middleware system is extremely flexible and built on the core principle of second-class typing. This means that the middleware pipeline itself is not typed, but you add a type definition on top of it & pretend it is. It is important that every layer of the middleware definition is built on `interface`s as these can be extended by third party packages. Nested objects must also use `interface`s, as nested objects embedded within an interface are implicitly `type`s, which cannot be extended.

Following is an example of how the `@apophis-sdk/cosmos` package extends the middleware definition to add Amino encoding support:

```typescript
import { type CosmosNetworkConfig } from '@apophis-sdk/core';
import { mw } from '@apophis-sdk/core/middleware.js';
import { Amino } from './encoding.js';

declare module '@apophis-sdk/core/middleware.js' {
  interface MiddlewareEncoding {
    amino: MiddlewareAmino;
  }
}

export interface MiddlewareAmino {
  encode(network: CosmosNetworkConfig, value: unknown): unknown;
  decode(network: CosmosNetworkConfig, value: unknown): unknown;
}

mw.use({
  encoding: {
    amino: { encode: Amino.encode, decode: Amino.decode },
  },
});

mw('encoding', 'amino', 'encode').fifo(network, { foo: 'bar' });
```

The `declare module` block is used to inject our new extension into the encoding middleware definition. The extension itself is unique to this sub-module, so it is exported from our own sub-module, so dependent packages may extend it as well if necessary. We then immediately define a default implementation for our new middleware module using the `mw.use` method.

### Integrating new Amino Types
Amino is a vastly simpler encoding format than protobuf. Accordingly, integrating types is generally much easier. The Apophis SDK foresees that messages are defined as classes, which allows it to provide various assertions for type safety and normalization.

## Account Index vs Number
Within the framework (but not only here), *account index* & *account number* are two closely related yet very distinct terms.

**Account Index** refers to the *local* index of the user's account as determined by the private key derivation path. While its concrete meaning and definition depends on the concrete wallet, generally it most likely directly translates to the [Account Path Level of BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#user-content-Account).

**Account Number**, on the other hand, is the *global* integral ID of the account as tracked on the distributed ledger. This value is typically not determined by the wallet but by the network's validators/miners, and populated when an account is first funded. Not every blockchain tracks its accounts, sometimes deliberately for privacy reasons. The account number should be an implementation detail such that a consumer of this framework need not worry over it.

## Extending Apophis' Configuration
In the file `@apophis-sdk/core/constants.ts`, one can find the Apophis configuration object `config`. This object can be used to configure the SDK globally. You may simply add your own properties to the object, but you should also extend the `ApophisConfig` interface with [TypeScript module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) like so:

```typescript
declare module '@apophis-sdk/core/types.js' {
  interface ApophisConfig {
    myNewProperty: string;
  }
}
```

This snippet would go into your integration's index file, assuming it will always be imported. Alternatively, you may place it in an [ambient module](https://www.typescriptlang.org/docs/handbook/modules/reference.html#ambient-modules), but this changes how the augmentation must be loaded.
