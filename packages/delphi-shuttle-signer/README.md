# @apophis-sdk/delphi-shuttle-signer
Integration for [Delphi's Shuttle Wallet Adapter](https://shuttle.delphilabs.io/) for the [Apophis Cosmos SDK](../../README.md).

This integration wraps the Shuttle Wallet Adapter in a Signer that can be used with the Apophis SDK as per usual. As Shuttle is wider used and better maintained, it is a great option for React Dapps. It likely works with Preact as well, albeit untested, and with possible performance implications.

## Installation
Install with your favorite package manager's equivalent of:

```bash
npm install @apophis-sdk/core @apophis-sdk/delphi-shuttle-signer
```

You will most likely be using [React](https://react.dev/), so install these packages as well:

```bash
npm install react @preact/signals-react
```

Apophis uses Preact's signals (though you don't have to), so you may want to install [@preact-signals/safe-react](https://www.npmjs.com/package/@preact-signals/safe-react) as well:

```bash
npm install @preact-signals/safe-react
```

And hook it up to your build process in order to seamlessly integrate Preact's signals. Otherwise, you will need to call the `useSignals()` hook manually, in every component that uses it, and it still does not provide the same performance benefits and experience.

## Usage
```typescript
// TODO
```
