# Apophis SDK Integrations
The SDK is still in heavy development. I thus discourage developing custom integrations at this time.

We distinguish between three types of integrations:

1. **Wallet Integrations**
2. **Frontend Integrations**
3. **Chain Integrations**

***TODO*** - Sorry, still writing.

## Account Index vs Number
Within the framework (but not only here), *account index* & *account number* are two closely related yet very distinct terms.

**Account Index** refers to the *local* index of the user's account as determined by the private key derivation path. While its concrete meaning and definition depends on the concrete wallet, generally it most likely directly translates to the [Account Path Level of BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#user-content-Account).

**Account Number**, on the other hand, is the *global* integral ID of the account as tracked on the distributed ledger. This value is typically not determined by the wallet but by the network's validators/miners, and populated when an account is first funded. Not every blockchain tracks its accounts, sometimes deliberately for privacy reasons. The account number should be an implementation detail such that a consumer of this framework need not worry over it.
