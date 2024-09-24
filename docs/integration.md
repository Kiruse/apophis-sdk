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
***TODO***

## Chain Integrations
Chain integrations are not currently supported yet. In future, they will be implemented to enable support for subtle changes between chains, such as [Injective's custom Token Factory module](https://docs.ts.injective.network/core-modules/token-factory) versus the [canonical Osmosis module](https://docs.osmosis.zone/osmosis-core/modules/tokenfactory/), differences in network transport protocols, or changes to JSON-RPC methods.

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
