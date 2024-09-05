import { computed, signal } from '@preact/signals-core';
import type { NetworkConfig, Signer } from './types';
import { Account } from './account';
import { signers } from './constants';

/** The logged-in signer, if any. */
export const signer = signal<Signer>();

/** The current account, if any signer was chosen. The account itself may be yet unbound. */
export const account = signal<Account>();

/** The current account data, for comprehensive updates to account changes. */
export const accdata = computed(() => account.value?.signal.value);

/** The default network of your Dapp. Used by `network` signal while no account is connected (and bound). */
export const defaultNetwork = signal<NetworkConfig>();

/** The currently selected network, if any. */
export const network = computed(() => {
  // explicitly invoke both signals to assert compute dependency
  const net1 = account.value?.network;
  const net2 = defaultNetwork.value;
  return net1 ?? net2;
});

/** The currently selected network's chain ID, if any. */
export const chainId = computed(() => network.value?.chainId);

/** The address of the current account on the bound network, if any. */
export const address = computed(() => account.value?.address);

/** Helper signal to get the bech32 address prefix for the current network, if configured. */
export const bech32Prefix = computed(() => network.value?.addressPrefix);

if (globalThis.localStorage) {
  accdata.subscribe(data => {
    if (data) {
      localStorage.setItem('@apophis-sdk:account', JSON.stringify({
        signer: signer.value!.type,
        network: data.network,
        accountIndex: data.accountIndex,
      }));
    } else {
      if (!initialized) return; // preact calls subscribe on attach too, but it's still undefined
      localStorage.removeItem('@apophis-sdk:account');
    }
  });

  // try to restore
  if (localStorage.getItem('@apophis-sdk:account')) {
    const accountData = JSON.parse(localStorage.getItem('@apophis-sdk:account')!);
    initSigner(accountData);
    window.addEventListener('load', () => {
      initSigner(accountData);
      setTimeout(() => initSigner(accountData), 3000);
    });
  }
}

var initialized = false;
function initSigner({ signer: type, network, accountIndex }: { signer: string, network: NetworkConfig, accountIndex: number }) {
  if (initialized || !signer.value) {
    const found = signers.find(signer => signer.type === type);
    if (!found) return;
    signer.value = found;
    const acc = found.account();
    acc.bind(network, accountIndex).then(() => {
      account.value ??= acc;
    });
  }
  initialized = true;
}
