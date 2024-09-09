import { computed, signal } from '@preact/signals-core';
import type { NetworkConfig, Signer } from './types';

/** The logged-in signer, if any. */
export const signer = signal<Signer>();

/** The current account data, for comprehensive updates to account changes. */
export const signdata = computed(() => signer.value?.signData.value);

/** The currently selected network, if any. */
export const network = signal<NetworkConfig>();

/** The currently selected network's chain ID, if any. */
export const chainId = computed(() => network.value?.chainId);

/** The address of the current signer on the bound network, if any. */
export const address = computed(() => signdata.value?.address);

/** Helper signal to get the bech32 address prefix for the current network, if configured. */
export const bech32Prefix = computed(() => network.value?.addressPrefix);
