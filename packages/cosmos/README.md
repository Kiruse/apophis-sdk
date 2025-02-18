# @apophis-sdk/cosmos
Cosmos ecosystem support for the Apophis SDK. Apophis is a strongly opinionated SDK for building web3 applications in different ecosystems.

***TODO:*** Example usage.

Check out the [GitBook](https://apophis-sdk.gitbook.io/apophis-sdk/) for more information.

## Development & Testing
Development & unit/integration testing is done with [bun](https://bun.sh). [cosmjs](https://cosmos.github.io/cosmjs/) is used as reference implementation, but the entire library is written from scratch, and particularly for integration testing to ensure our implementation achieves the same behaviors.

To run the tests:

```bash
cd packages/cosmos
bun test
```

# License
[LGPL-3.0](../../LICENSE)
