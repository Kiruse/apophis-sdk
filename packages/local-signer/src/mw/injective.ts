import { type NetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { mw, type MiddlewareImpl } from "@apophis-sdk/core/middleware.js";
import { bech32 } from 'bech32';
import * as secp256k1 from '@noble/secp256k1';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';
import { toHex } from '@apophis-sdk/core/utils.js';

mw.use(
  {
    addresses: {
      compute: (network: NetworkConfig | string, publicKey: PublicKey) => {
        if (network === 'inj' || typeof network !== 'string' && network.name !== 'injective') return;
        if (!pubkey.isSecp256k1(publicKey)) throw new Error('Invalid pubkey type, expected secp256k1');

        const prefix = typeof network === 'string' ? network : network.addressPrefix;
        let key = publicKey.key;
        if (key.length === 33)
          key = secp256k1.ProjectivePoint.fromHex(publicKey.key).toRawBytes(false);
        if (key.length !== 65) throw new Error(`Invalid pubkey length, expected 65, got ${key.length}`);

        // see https://docs.injective.network/learn/basic-concepts/accounts/
        // and https://github.com/ethereumjs/ethereumjs-monorepo/blob/4da66478872e807ea100c9c13e0e375c0bf2319f/packages/util/src/account.ts#L597
        // and https://privatekeys.pw/calc (FAQ)
        const ethAddr = keccak256(key.slice(1)).slice(-20);
        return bech32.encode(prefix, bech32.toWords(ethAddr));
      },
    },
  }
)
