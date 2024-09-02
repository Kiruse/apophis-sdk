# Apophis SDK
Apohis SDK is a Work-in-Progress, extensible Web3 wallet integration framework for Cosmos blockchains, designed to be a frontend-agnostic one-stop shop for CosmWasm smart contract developers. At this stage, only an integration for Preact exists. I may add further integrations & improve the Cosmos SDK support later, and am always willing to merge community-contributed integrations.

Apophis SDK builds on [@preact/signals-core](https://www.npmjs.com/package/@preact/signals-core) to supply consumer code with dynamically changing identity-related information. Integrations with other frontend libraries should wrap these into their respective native counterpieces for convenience.

Apophis SDK is named after [the near-Earth asteroid 99942 Apophis](https://en.wikipedia.org/wiki/99942_Apophis), the obscure interloper of the Sol system.

# Install
Apophis SDK is not yet officially published to the NPM registry. Until then, [head to GitHub](https://github.com/kiruse/apophis-sdk) and download the packages from the releases.

# Usage
Apophis SDK consists of 3 types of integrations: signers, frontend, and chain integrations. Signers abstract wallets, and frontend integrations wrap signers into digestible & reactive components ready for use in your dapp. Chain integrations abstract the API of individual chains.

## Signers
Signers resemble the interface between your dapp and the user. Almost every operation here is asynchronous. The basic workflow is as follows:

1. Prompt user for signer
2. Authenticate user, get `Account`
3. `.bind` the `Account` to a network (and optional *account index*)
4. Ask `Account` to `.sign` a message
5. `.broadcast` the yielded `SignedMessage`

Typically, you will use multiple wallet integrations. We further distinguish between *local* & *remote* signers. Local signers are intended to be used in local environments such as backends or tools. Remote signers are intended to be used in the frontend and are powered by third party wallets such as Keplr or Leap.

The following wallet integrations exist:

- [@apophis-sdk/keplr-signer](packages/keplr-signer/README.md)

The following wallet integrations are planned:

- `@apophis-sdk/cosmostation-signer`
- `@apophis-sdk/leap-signer`
- `@apophis-sdk/leap-metamask-signer`
- `@apophis-sdk/station-signer`

## Frontend Integrations
`@apophis-sdk/core` is built on `@preact/signals-core`. Thus, frontend integrations should hook into these signals to expose them according to their ecosystem's norm. This enables a fully automated feedback chain throughout the entire Dapp as well as the logical parts under the hood.

Most likely, your project will use exactly one frontend integration. As frontend frameworks can vary wildly, refer to each specific integration for its usage details. The following integrations currently exist:

- [@apophis-sdk/preact](packages/preact/README.md)

The following frontend integrations are planned:

- `@apophis-sdk/react`
- `@apophis-sdk/vanilla`

## Chain Integrations
Currently, Apophis SDK does not distinguish between different chains. This is because it's actually really hard to gather the correct information from the various blockchains which can theoretically even alter data types from the Cosmos SDK baseline. For now, it simply assumes that all chains share a minimal common API and a minimal set of data types.

However, there are already various preparations met for supporting the nuances of different Cosmos chains. With these preparations it is possible to integrate chain-specific nuances to Protobuf serialization and REST API easily by simply importing a chain integration. But I have yet to figure out how to integrate chain-specific nuances to the RPC API.

## Networks & API Connections
Apophis SDK is designed to be multi-chain. Thus, a `NetworkConfig` is required almost everywhere. In part, these `NetworkConfig` object instances are associated in verbatim with additional data. Thus, treat these configuration objects as elementary, and hand them around as a whole (as opposed to constructing them on-the-fly).

Apophis SDK comes with a `@apophis-sdk/core/connections.js` module which exposes some rudimentary endpoint URL management by `NetworkConfig`. Often, you will only need a REST API in which case the SDK defaults to the [cosmos.directory proxy](https://cosmos.directory). However, sometimes you may want to override these URLs in order to provide your own RPC server, or allow the end user to bring their own node. I steadfastly believe the endpoint should always be configurable even in your GUI, and never hard-coded other than for providing defaults.

Note that *WebSocket* endpoints are not always exposed to the public. For these, Apophis SDK does not (currently) provide any algorithmic defaults, and they will always have to be directly configured. You may try to simply connect to the RPC endpoint, changing the protocol to `wss` and appending `websocket`, but this is not a guarantee. Further, as WebSockets maintain their connection, changing the configured endpoint on the fly does not automatically reconnect existing WebSockets.

# Further Documentation
- [Writing new integrations](docs/integration.md)

# Development
Some tools are used for the development of this project to automate builds. Under Windows, the easiest is to run [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install).

- Bash.
- [jq](https://jqlang.github.io/jq/download/)
- Docker. To test packages locally, I use a temporary deployment of Verdaccio to create a local NPM registry.

## Local Testing
While there are various ways to test a frontend library, I find the most reliable one is to approximate the final production environment as closely as possible. This includes building, publishing to & pulling packages from a registry. Here, I use [Verdaccio](https://verdaccio.org/) to create a local temporary registry with the `localreg.sh` script & Docker.

The script creates a Docker container which will be removed once closed. Thus, you will need to create a new user every time you launch the local registry with `npm adduser --registry http://localhost:4873`. Then, you can run `./publish.sh`.

In future, I may automate this process further with additional customizations to the local Verdaccoi deployment.

# License
apophis-sdk is licensed under **LGPL-3.0**.

In general, this means any direct derivative works of apophis-sdk must be contributed likewise as LGPL-3.0. However, this does not apply when merely "linking" apophis-sdk in your product as a dependency.
