# Apophis SDK Middlewares
Apophis SDK uses a generalized middleware system with TypeScript typing sprinkled on top. Much inspired by my [@kiruse/restful](https://github.com/kiruse/restful.ts) library, the underlying system is untyped with type safety added on top. This allows for a highly flexible & extensible system without altering the core library.

## Usage
The middleware system is exposed through the `@apophis-sdk/core/middleware.js` module's `mw` object/method.

As an Apophis SDK consumer, you will only ever need to add middlewares like so:

```typescript
import apophis from '@apophis-sdk/core';
import { MemoryAddressBook, LocalStorageAddressBook } from '@apophis-sdk/core/address';
apophis.use(LocalStorageAddressBook, MemoryAddressBook);
```

This will register your desired middlewares. You will rarely ever need to interact with the middleware system directly.

As an Apophis SDK integration implementor, you may access `mw` to interface with the entire middleware stack following different available strategies:

```typescript
import { mw } from '@apophis-sdk/core/middleware';

// fifo - first in, first out - calls to the registered middlewares will be processed in the order
// they were registered. The first middleware in the stack that returns a non-undefined value will
// be returned, and subsequent middlewares will be skipped.
mw('addresses', 'alias').fifo('cosmos1...');

// transform takes a single argument and returns a value of the same type. The result is passed to
// the next middleware in the stack. If a middleware does not alter the value, it should return it
// unmodified.
mw('addresses', 'alias').transform('cosmos1...');
```

## Implementing Middlewares
Middlewares are arbitrary objects that satisfy `DeepPartial<Middleware>`. If a middleware does not implement a method, it is automatically skipped. The following examples are valid middlewares:

```typescript
import { type MiddlewareImpl } from '@apophis-sdk/core/middleware.js';

const MyMiddleware1 = {
  addresses: {
    alias(address) {
      return address;
    },
  },
} satisfies MiddlewareImpl;

const MyMiddleware2 = {
  addresses: {
    resolve(address) {
      return address;
    },
  },
} satisfies MiddlewareImpl;

const MyMiddleware3 = {} satisfies MiddlewareImpl;

class MyMiddleware4 implements MiddlewareImpl {
  addresses = {
    alias(address) {
      return address;
    },
  };
}
```

`satisfies MiddlewareImpl` is optional, but allows for improved type safety. It is preferred over `const MyMiddleware: MiddlewareImpl = ...` because the latter does not allow for additional properties on the middleware object. `satisfies MiddlewareImpl` enforces that all required methods are implemented whilst preserving the unique type of your middleware object.

## Middleware Stack
The `mw` method exposes some additional properties. One of these properties is `mw.stack`, which is an array of all registered middlewares. If necessary, you can inspect or even alter the stack:

```typescript
import { mw } from '@apophis-sdk/core/middleware.js';
import { MemoryAddressBook } from '@apophis-sdk/core/address.js';

// Insert a middleware before `MemoryAddressBook` or append to the end if not found
let idx = mw.stack.findIndex(m => m instanceof MemoryAddressBook);
if (idx !== -1) {
  mw.stack.splice(idx, 0, MyMiddleware);
} else {
  mw.stack.push(MyMiddleware);
}
```
