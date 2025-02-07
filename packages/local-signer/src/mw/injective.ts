import { Any, type NetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { mw } from "@apophis-sdk/core/middleware.js";
import { bech32 } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

// injective is a special bean that needs a crapton of customizations due to the evm support
// this is unfinished & insufficient. feel free to fix it if you need injective support
mw.use(
  {
    addresses: {
      compute: (network: NetworkConfig, publicKey: PublicKey) => {
        // the first check is redundant, but it allows TypeScript to narrow the NetworkConfig to a CosmosNetworkConfig
        if (network.ecosystem !== 'cosmos' || network.name !== 'injective') return;
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
    encoding: {
      protobuf: {
        encode: (network: NetworkConfig, value: any) => {
          if (network.name !== 'injective' || !pubkey.isSecp256k1(value)) return;
          const bytes = Uint8Array.from([10, value.key.length, ...value.key]);
          return Any('/injective.crypto.v1beta1.ethsecp256k1.PubKey', bytes);
        },
        decode: (network: NetworkConfig, value: any) => {
          if (network.name !== 'injective') return;
          if (value.typeUrl !== '/injective.crypto.v1beta1.ethsecp256k1.PubKey') return;
          // magic type byte (fixed) + length (fixed) + key bytes (variable)
          if (value.value[0] !== 10 || value.value[1] !== 33) throw Error('Invalid public key');
          return pubkey.secp256k1(value.value.slice(2));
        },
      },
    },
  }
)
