import { signals, Signer } from '@apophis-sdk/core';
import { Cosmos } from '@apophis-sdk/cosmos';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

export default function App() {
  useSignals();
  const [availableSigners, setAvailableSigners] = useState<Signer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Probe all signers for availability
    const probeSigners = async () => {
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

      setAvailableSigners(available);
    };

    probeSigners();

    // Try to set a default network
    const initNetwork = async () => {
      try {
        // Check if GalaxyStation is available and use terra network for it
        const galaxyStationSigner = Signer.signers.find(s => s.type === 'GalaxyStation');
        const networkName = galaxyStationSigner && await galaxyStationSigner.probe()
          ? 'terra'
          : 'neutrontestnet';

        const network = await Cosmos.getNetworkFromRegistry(networkName);
        if (!signals.network.value) {
          signals.network.value = network;
        }
      } catch (err) {
        console.warn('Could not load network:', err);
      }
    };

    initNetwork();
  }, []);

  const handleConnect = async (signer: Signer) => {
    setLoading(true);
    setError(null);

    try {
      // Use terra network for GalaxyStation, otherwise use current network
      let network = signals.network.value;
      if (signer.type === 'GalaxyStation') {
        try {
          network = await Cosmos.getNetworkFromRegistry('terra');
          signals.network.value = network;
        } catch (err) {
          console.warn('Could not load terra network for GalaxyStation:', err);
        }
      }

      if (!network) {
        throw new Error('No network selected');
      }

      const accounts = await signer.connect([network]);
      signals.signer.value = signer;

      if (accounts.length > 0) {
        console.log('Connected accounts:', accounts);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to connect: ${message}`);
      console.error('Connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const signer = signals.signer.value;
      if (signer) {
        await signer.disconnect();
        signals.signer.value = undefined;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to disconnect: ${message}`);
      console.error('Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentSigner = signals.signer.value;
  const currentAccount = signals.account.value;
  const currentAddress = signals.address.value;
  const network = signals.network.value;

  return (
    <div className="app">
      <h1>Cosmos Signers - React Test</h1>

      <div className="section">
        <h2>Connection Status</h2>
        <div className={`status ${currentSigner ? 'connected' : 'disconnected'}`}>
          {currentSigner ? `Connected: ${currentSigner.displayName}` : 'Not Connected'}
        </div>

        {currentAccount && currentAddress && (
          <div className="account-info">
            <div><strong>Address:</strong> {currentAddress}</div>
            {network && <div><strong>Network:</strong> {network.chainId}</div>}
          </div>
        )}
      </div>

      <div className="section">
        <h2>Available Signers</h2>
        {availableSigners.length === 0 ? (
          <p>No signers available. Make sure you have a wallet extension installed.</p>
        ) : (
          <ul className="signers-list">
            {availableSigners.map((signer) => (
              <li key={signer.type} className="signer-item">
                <div className="signer-info">
                  {signer.logoURL && (
                    <img
                      src={signer.logoURL.toString()}
                      alt={signer.displayName}
                      className="signer-logo"
                    />
                  )}
                  <div>
                    <div><strong>{signer.displayName}</strong></div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{signer.type}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleConnect(signer)}
                  disabled={loading || (currentSigner?.type === signer.type)}
                >
                  {currentSigner?.type === signer.type ? 'Connected' : 'Connect'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {currentSigner && (
        <div className="section">
          <h2>Actions</h2>
          <div className="buttons">
            <button onClick={handleDisconnect} disabled={loading} className="danger">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

