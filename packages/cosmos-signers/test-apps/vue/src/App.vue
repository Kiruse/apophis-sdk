<template>
  <div class="app">
    <h1>Cosmos Signers - Vue Test</h1>

    <div class="section">
      <h2>Connection Status</h2>
      <div :class="['status', currentSigner ? 'connected' : 'disconnected']">
        {{ currentSigner ? `Connected: ${currentSigner.displayName}` : 'Not Connected' }}
      </div>

      <div v-if="currentAccount && currentAddress" class="account-info">
        <div><strong>Address:</strong> {{ currentAddress }}</div>
        <div v-if="network"><strong>Network:</strong> {{ network.chainId }}</div>
      </div>
    </div>

    <div class="section">
      <h2>Available Signers</h2>
      <p v-if="availableSigners.length === 0">
        No signers available. Make sure you have a wallet extension installed.
      </p>
      <ul v-else class="signers-list">
        <li v-for="signer in availableSigners" :key="signer.type" class="signer-item">
          <div class="signer-info">
            <img
              v-if="signer.logoURL"
              :src="signer.logoURL.toString()"
              :alt="signer.displayName"
              class="signer-logo"
            />
            <div>
              <div><strong>{{ signer.displayName }}</strong></div>
              <div style="font-size: 0.85rem; color: #666">{{ signer.type }}</div>
            </div>
          </div>
          <button
            @click="handleConnect(signer)"
            :disabled="loading || (currentSigner?.type === signer.type)"
          >
            {{ currentSigner?.type === signer.type ? 'Connected' : 'Connect' }}
          </button>
        </li>
      </ul>
    </div>

    <div v-if="currentSigner" class="section">
      <h2>Actions</h2>
      <div class="buttons">
        <button @click="handleDisconnect" :disabled="loading" class="danger">
          Disconnect
        </button>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { signals, Signer } from '@apophis-sdk/core';
import { Cosmos } from '@apophis-sdk/cosmos';
import { registerCosmosSigners } from '@apophis-sdk/cosmos-signers';

const availableSigners = ref<Signer[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const currentSigner = computed(() => signals.signer.value);
const currentAccount = computed(() => signals.account.value);
const currentAddress = computed(() => signals.address.value);
const network = computed(() => signals.network.value);

onMounted(async () => {
  // Register all cosmos signers
  registerCosmosSigners();

  // Probe all signers for availability
  const signers = Signer.signers;
  const available: Signer[] = [];

  for (const signer of signers) {
    try {
      const isAvailable = await signer.probe();
      if (isAvailable) {
        available.push(signer);
      }
    } catch (err) {
      console.error(`Error probing signer ${signer.type}:`, err);
    }
  }

  availableSigners.value = available;

  // Try to set a default network
  try {
    // Check if GalaxyStation is available and use terra network for it
    const galaxyStationSigner = signers.find(s => s.type === 'GalaxyStation');
    const networkName = galaxyStationSigner && await galaxyStationSigner.probe()
      ? 'terra'
      : 'neutrontestnet';

    const defaultNetwork = await Cosmos.getNetworkFromRegistry(networkName);
    if (!signals.network.value) {
      signals.network.value = defaultNetwork;
    }
  } catch (err) {
    console.warn('Could not load network:', err);
  }
});

const handleConnect = async (signer: Signer) => {
  loading.value = true;
  error.value = null;

  try {
    // Use terra network for GalaxyStation, otherwise use current network
    let currentNetwork = signals.network.value;
    if (signer.type === 'GalaxyStation') {
      try {
        currentNetwork = await Cosmos.getNetworkFromRegistry('terra');
        signals.network.value = currentNetwork;
      } catch (err) {
        console.warn('Could not load terra network for GalaxyStation:', err);
      }
    }

    if (!currentNetwork) {
      throw new Error('No network selected');
    }

    const accounts = await signer.connect([currentNetwork]);
    signals.signer.value = signer;

    if (accounts.length > 0) {
      console.log('Connected accounts:', accounts);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    error.value = `Failed to connect: ${message}`;
    console.error('Connection error:', err);
  } finally {
    loading.value = false;
  }
};

const handleDisconnect = async () => {
  loading.value = true;
  error.value = null;

  try {
    const signer = signals.signer.value;
    if (signer) {
      await signer.disconnect();
      signals.signer.value = undefined;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    error.value = `Failed to disconnect: ${message}`;
    console.error('Disconnect error:', err);
  } finally {
    loading.value = false;
  }
};
</script>

