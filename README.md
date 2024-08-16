# Crypto-Me
Crypto-Me is a Work-in-Progress, extensible wallet integration framework for the web. Unlike others, it is agnostic of its frontend library and can even be used with relative ease in a completely vanilla HTML/CSS/JS stack. Integrations for React & Preact exist. I may add further integrations later, and am always willing to merge community-contributed integrations.

Developing generic & broad systems is hard. Currently, *Crypto-Me* only supports the Cosmos ecosystem, with support for EVM & SVM planned further down the road.

Crypto-Me builds on [@preact/signals-core](https://www.npmjs.com/package/@preact/signals-core) to supply consumer code with dynamically changing identity-related information. Integrations with other frontend libraries should wrap these into their respective native counterpieces for convenience.

# Install
Crypto-Me is not yet officially published to the NPM registry. Until then, [head to GitHub](https://github.com/kiruse/crypto-me) and download the packages from the releases.

# Usage
Crypto Me consists of signers & frontend integrations. Signers abstract wallets, and frontend integrations wrap signers into digestible & reactive components ready for use in your dapp.

## Signers
Signers resemble the interface between your dapp and the user. Almost every operation here is asynchronous. The basic workflow is as follows:

1. Prompt user for signer
2. Authenticate user, get `Account`
3. `.bind` the `Account` to a network (and optional *account index*)
4. Ask `Account` to `.sign` a message
5. `.broadcast` the yielded `SignedMessage`

Typically, you will use multiple wallet integrations. Your usage of these integrations will depend on two main factors: the *ecosystem*, and the transaction *payload* type.

For example, in Cosmos, two types of transaction payloads exist: *Amino* & *Protobuf* (aka *Direct*). While the general API is identical, the payload passed around varies, and may imply the necessity for additional configuration. The wallet integration should already try its best to implement most details automatically behind the scenes. The integration should mention which additional configuration is necessary, if any.

The following wallet integrations exist:

- [@crypto-me/keplr-signer](packages/keplr-signer/README.md)
- [@crypto-me/leap-signer](packages/leap-signer/README.md)

## Frontend Integrations
`@crypto-me/core` is built on `@preact/signals-core`. Thus, frontend integrations should hook into these signals to expose them according to their ecosystem's norm. This enables a fully automated feedback chain throughout the entire Dapp as well as the logical parts under the hood.

Most likely, your project will use exactly one frontend integration. As frontend frameworks can vary wildly, refer to each specific integration for its usage details:

- [@crypto-me/react](packages/react/README.md)
- [@crypto-me/preact](packages/preact/README.md)

## Networks & API Connections
Crypto-Me is designed to be multi-chain. Thus, a `NetworkConfig` is required almost everywhere. In part, these `NetworkConfig` object instances are associated in verbatim with additional data. Thus, treat these configuration objects as elementary, and hand them around as a whole (as opposed to constructing them on-the-fly).

Crypto-Me comes with a `@crypto-me/core/connections.js` module which exposes some rudimentary endpoint URL management by network. Often, you will only need a REST API, and often this URL can be algorithmically determined through the help of proxy sites like [cosmos.directory](https://cosmos.directory) or [publicnode.com](https://publicnode.com). However, sometimes you may want to override these URLs in order to provide your own RPC server, or allow the end user to bring their own node. Thus, I steadfastly believe the endpoint should always be configurable, and never hard-coded other than for providing defaults.

Further, *WebSocket* endpoints are not always exposed to the public. For these, Crypto-Me does not (currently) provide any algorithmic defaults, and they will always have to be directly configured. Further, as WebSockets maintain their connection, changing the configured endpoint does not automatically reconnect existing WebSockets.

# Further Documentation
- [Writing new integrations](docs/integration.md)

# TODO
- [ ] Keplr Signer
- [ ] Leap Signer
- [ ] React Integration
- [ ] Preact Integration
- [ ] **Amino support.** Amino is non-trivial as different chains can have different Amino types as defined by their SDK modules. The [cosmjs library itself](https://github.com/cosmos/cosmjs/blob/e819a1fc0e99a3e5320d8d6667a08d3b92e5e836/packages/stargate/src/signingstargateclient.ts#L404) shows there is no simple solution. Amino is deprecated and thus enjoys lowered priority for the purpose of this library. But as it is currently still the only supported format for [Ledger hardware wallets](https://ledger.com), it is still important enough to implement rather sooner than later.
- [ ] Web3 Sign In ([ERC-4361](https://eips.ethereum.org/EIPS/eip-4361) + [ADR-36](https://github.com/cosmos/cosmos-sdk/blob/main/docs/architecture/adr-036-arbitrary-signature.md))
- [ ] Normalize & unify multiple `Tx` subscriptions with the same tendermint query.

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
Crypto-Me is licensed under **LGPL-3.0**.

In general, this means any direct derivative works of Crypto-Me must be contributed likewise as LGPL-3.0. However, this does not apply when merely "linking" Crypto-Me in your product as a dependency.
