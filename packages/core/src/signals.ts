import { computed, signal } from '@preact/signals-core';
import type { Signer } from './signer';
import type { NetworkConfig } from './types';

/** The logged-in signer, if any. */
export const signer = signal<Signer>();

/** Active signing data map for the current signer. */
export const signDatas = computed(() => signer.value?.signDatas.value);

/** The current signing data. Updated when either the signer, the signer's active keystore, or the selected network changes. */
export const signData = computed(() => network.value && signDatas.value?.get(network.value));

/** The currently selected network, if any. */
export const network = signal<NetworkConfig>();

/** The currently selected network's chain ID, if any. */
export const chainId = computed(() => network.value?.chainId);

/** The address of the current signer on the bound network, if any. */
export const address = computed(() => signData.value?.[0]?.address);

/** Helper signal to get the bech32 address prefix for the current network, if supported & configured. */
export const bech32Prefix = computed(() => network.value?.ecosystem === 'cosmos' ? network.value?.addressPrefix : undefined);
