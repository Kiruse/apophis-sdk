import { computed, signal } from '@preact/signals-core';
import type { Signer } from './signer';
import type { NetworkConfig } from './types';

/** The logged-in signer, if any. */
export const signer = signal<Signer>();

/** The currently selected network, if any. */
export const network = signal<NetworkConfig>();

/** The currently selected network's chain ID, if any. */
export const chainId = computed(() => network.value?.chainId);

/** First account of the current signer bound to the current network, if any. */
export const account = computed(() => {
  const net = network.value;
  if (!net) return;
  return signer.value?.accounts.value.find(acc => acc.isBound(net));
});

/** The public key of the current signer on the bound network, if any. */
export const publicKey = computed(() => account.value?.publicKey);

/** The address of the current signer on the bound network, if any. */
export const address = computed(() => account.value?.getSignData(network.value!).value.address);

/** Helper signal to get the bech32 address prefix for the current network, if supported & configured. */
export const bech32Prefix = computed(() => network.value?.ecosystem === 'cosmos' ? network.value?.addressPrefix : undefined);
