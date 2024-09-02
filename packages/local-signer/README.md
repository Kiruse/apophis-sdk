# @apophis-sdk/local-signer
Local private key / mnemonic based signer for the [Apophis SDK Web3 Identity Framework](../../README.md).

This signer is intended for use in local environments in conjunction with a raw private key or mnemonic. It can hypothetically be used to build a web wallet, however, this is strongly discouraged unless you're a cybersecurity professional. In a dapp, it is strongly recommended to use a wallet provider with a corresponding Apophis SDK signer integration. In a local tool, it is strongly recommended to use an encrypted keyring for private key and/or mnemonic provisioning.

# Installation
Currently, this package is not published to NPM. Instead, please build from source, or download a release from the [GitHub Releases](https://github.com/kiruse/apophis-sdk/releases) page.

# Usage
The local signer is much unlike the other signers of the Apophis SDK framework. It thus has a different usage pattern:

```ts
import { Cosmos } from '@apophis-sdk/core/api/cosmos.js';
import { LocalSigner, Account } from '@apophis-sdk/local-signer';
import { fromHex } from '@apophis-sdk/core/utils.js';

const privateKey = fromHex('0x1234567890123456789012345678901234567890123456789012345678901234');
const account = new Account(privateKey);

const tx = LocalSigner.tx({
  // ... tx contents
});

await account.sign(tx);
tx.status === 'signed';

const hash = await LocalSigner.broadcast(tx);
const tx = await Cosmos.tx.txs[hash]('GET');
```
