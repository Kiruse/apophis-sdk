import { computed, signal } from '@preact/signals-core';
import type { Signer } from './signer';
import type { NetworkConfig } from './types';

/** The logged-in signer, if any. */
export const signer = signal<Signer>();

/** The currently selected network, if any. */
export const network = signal<NetworkConfig>();

/** The currently selected network's chain ID, if any. */
export const chainId = computed(() => network.value?.chainId);

/** The public key of the current signer on the bound network, if any. */
export const publicKey = computed(() => network.value && signer.value?.pubkey(network.value));

/** The address of the current signer on the bound network, if any. */
export const address = computed(() => network.value && signer.value?.address(network.value));

/** Helper signal to get the bech32 address prefix for the current network, if supported & configured. */
export const bech32Prefix = computed(() => network.value?.ecosystem === 'cosmos' ? network.value?.addressPrefix : undefined);
