import { ProtobufMiddleware } from './encoding/protobuf/any.js';
import { mw } from './middleware.js';
import type { Signer } from './signer.js';

export * from './address.js';
export { Any } from './encoding/protobuf/any.js';
export * from './endpoints.js';
export * from './constants.js';
export * from './networks.js';
export * as signals from './signals.js';
export * from './signer.js';
export * from './types.js';

const wallets: Signer[] = [];

export const DefaultMiddlewares = [
  ProtobufMiddleware,
];

export { mw };

export default {
  use: mw.use,
  wallets,
};
