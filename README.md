# Apophis SDK
Apohis SDK is a Work-in-Progress, extensible Cosmos blockchain Dapp SDK, designed to be a frontend-agnostic one-stop shop for Dapp developers. At this stage, only an integration for Preact exists, though I am still actively working on the SDK and will be adding more integrations as I go.

Apophis SDK is named after [the near-Earth asteroid 99942 Apophis](https://en.wikipedia.org/wiki/99942_Apophis), the obscure interloper of the Sol system.

See the [Documentation](https://docs.kiruse.dev/projects/apophis-sdk/) for more information.

## DEV NOTE
Starting with version 0.3.6, the Apophis SDK packages are all version-locked, meaning `@apophis-sdk/cosmos@0.3.6` is only guaranteed to work with `@apophis-sdk/core@0.3.6`. Without this, we've had issues with NPM installing two versions of `@apophis-sdk/core` even though it's a peer dependency of all subpackages, in turn breaking internal compatibility.

# License
[LGPL-3.0](./LICENSE)
