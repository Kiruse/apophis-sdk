# Apophis SDK Integrations
We distinguish between two types of integrations:

1. **Wallet Integrations**
2. **Frontend Integrations**

You are free to contribute your integrations as Pull Requests to this repository for publishing in the same `@apophis-sdk` npm namespace, or to simply publish them on your own.

# Wallet Integrations
See the [Keplr Integration](../packages/keplr-signer/README.md) for a reference implementation.

## Logo
Wallets are typically represented in the frontend with their logo. Thus, every signer should have a `logoURL` property or getter. While this may return any web-friendly URL, I advise to bake it into the integration as a data URL. This is the most widely supported solution among all frontend libraries, and simultaneously does not require any additional external requests.

***TODO***

## Architecture
Wallets are generally divided into 3 major components:

- `Signer`
- `Account`s, and
- Transactions (`Tx`)

The `Signer` is the primary interface which the framework consumer will interact with. It provides the developer with a mutable `Account` object which represents the user. This `Account` object should be enriched by the Signer during creation (using it's `.account()` method) with enough information to construct & sign the complete transaction from a `Tx` object. Finally, the `Tx` can be `.broadcast()` through the `Signer`. The only knowledge that should be required from the developer is which networks they support, and what that network's payload looks like.

***TODO: Diagram***

## Account Index vs Number
Within the framework, *account index* & *account number* are two closely related yet very distinct terms.

**Account Index** refers to the *local* index of the user's account as determined by the private key derivation path. While its concrete meaning and definition depends on the concrete wallet, generally it most likely directly translates to the [Account Path Level of BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#user-content-Account).

**Account Number**, on the other hand, is the *global* integral ID of the account as tracked on the distributed ledger. This value is typically not determined by the wallet but by the network's validators/miners, and populated when an account is first funded. Not every blockchain tracks its accounts, sometimes deliberately for privacy reasons. The account number should be an implementation detail such that a consumer of this framework need not worry over it.
