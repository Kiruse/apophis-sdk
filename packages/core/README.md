# @apophis-sdk/core
Apophis SDK is an extensible & malleable framework for building decentralized applications on various blockchains. The core package contains chain agnostic types & utilities while other packages provide integrations for entire ecosystems, individual chains, different wallets, and frontend frameworks.

The ethos of Apophis is: You know what you need. Apophis does not facilitate building multi-chain Dapps. The various ecosystems are too different, such that a one-size-fits-all solution is simply not feasible. Instead, Apophis provides different packages for different ecosystems, each with their own benefits & quirks. To build a multi-chain Dapp with Apophis, you will need to know how to build a single-chain Dapp in each relevant ecosystem first. Apophis itself then provides some common utilities such as wallet integration, detection, selection, transaction signing, and broadcasting.

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/cosmos @apophis-sdk/cosmwasm
```

The core module exports no concrete blockchain-related functionality. It only provides a shared foundation for other modules that do. Currently, those modules are:

- `@apophis-sdk/cosmos`
- `@apophis-sdk/cosmwasm`

With the following modules planned for the future:

- `@apophis-sdk/evm`
- `@apophis-sdk/svm` (for Solana)

Check out the [Apophis SDK GitBook](https://kirudev-oss.gitbook.io/apophis-sdk/) for more information.

# License
[LGPL-3.0](../../LICENSE)
