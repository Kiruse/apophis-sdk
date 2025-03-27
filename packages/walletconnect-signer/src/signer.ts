import { CosmosNetworkConfig, ExternalAccount, type NetworkConfig, Signer } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Cosmos, CosmosTx } from '@apophis-sdk/cosmos';
import { fromBase64, fromHex, toBase64, toHex } from '@apophis-sdk/core/utils.js';
import { ReadonlySignal, signal } from '@preact/signals-core';
import { SignClient as _SignClient } from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { type WalletConnectSignerConfig } from './config';
import { WalletConnectSignerError, WalletConnectSignerNotConnectedError } from './error';
import LOGO_DATA_URL from './logo';
import { prompt } from './prompt';
import { PeerAccount, SignClient, SignResponse } from './types.api';

export interface WCSignerBase {
  signClient: ReadonlySignal<SignClient | undefined>;
}

var signers = new Set<WeakRef<WalletConnectCosmosSigner>>();

export class WalletConnectCosmosSigner extends Signer<CosmosTx> implements WCSignerBase {
  #session: SessionTypes.Struct | undefined;
  #signClient: Promise<SignClient>;
  #networks: CosmosNetworkConfig[] = [];
  readonly signClient = signal<SignClient | undefined>();
  readonly type = 'walletconnect';
  readonly canAutoReconnect = true;
  readonly displayName = 'WalletConnect';
  readonly logoURL = LOGO_DATA_URL;

  constructor(public readonly config: WalletConnectSignerConfig) {
    super();
    this.available.value = true;
    this.#signClient = _SignClient.init({
      projectId: config.projectId,
      metadata: config.metadata,
    }).then(client => {
      this.signClient.value = client;
      client.on('session_update', (args) => {
        if (args.topic !== this.#session?.topic) return;
        this.#session.namespaces = args.params.namespaces;
      });
      // TODO: what happens when the session is deleted or expires?
      return client;
    });
    signers.add(new WeakRef(this));
  }

  probe() {
    // WalletConnect cannot deterministically tell if the user has any other remote wallets, so it's
    // always available.
    return Promise.resolve(true);
  }

  async connect(networks: NetworkConfig[]) {
    console.warn('CAVEAT: This version of the WalletConnect SignClient seems to be a buggy mess. I will keep an eye on new releases. Nonetheless, these errors should not prevent the integration from working.');
    networks = networks.filter(network => network.ecosystem === 'cosmos') as CosmosNetworkConfig[];
    const client = await this.#signClient;
    const session = await prompt(networks, client, this.config);
    this.#session = session;
    this.#networks = networks as CosmosNetworkConfig[];

    for (const network of networks) {
      const pks = await this.getPublicKeys([network as CosmosNetworkConfig]);
      await this.initAccounts(network, pks);
    }

    await this.updateSignData(networks as CosmosNetworkConfig[]);
    return this.accounts.peek();
  }

  async disconnect() {
    const client = await this.#signClient;
    for (const key of client.pairing.keys) {
      client.pairing.delete(key, { code: 6000, message: 'Disconnecting' });
    }
    for (const key of client.session.keys) {
      client.session.delete(key, { code: 6000, message: 'Disconnecting' });
    }
  }

  async sign(network: NetworkConfig, tx: CosmosTx): Promise<CosmosTx> {
    if (network.ecosystem !== 'cosmos') throw new Error('Currently, only Cosmos chains are supported');
    if (!this.#session) throw new WalletConnectSignerNotConnectedError();
    const client = await this.#signClient;
    const { topic } = this.#session;

    const signData = this.getSignData(network);
    if (!ExternalAccount.isComplete(signData))
      await this.updateSignData();
    if (!ExternalAccount.isComplete(signData)) throw new WalletConnectSignerError('Failed to load sign data');

    const sdkTx = tx.sdkTx(network, this);
    if (!sdkTx.authInfo || !sdkTx.body) throw new WalletConnectSignerError('Invalid transaction');

    const { signature, signed } = await client.request<SignResponse>({
      topic,
      chainId: 'cosmos:' + network.chainId,
      request: {
        method: 'cosmos_signDirect',
        params: {
          signerAddress: signData.address,
          signDoc: {
            chainId: network.chainId,
            accountNumber: signData.accountNumber.toString(),
            authInfoBytes: this.#encode(AuthInfo.encode(sdkTx.authInfo).finish()),
            bodyBytes: this.#encode(TxBody.encode(sdkTx.body).finish()),
          },
        },
      },
    });

    const signedAuthInfo = AuthInfo.decode(this.#decode(signed.authInfoBytes));
    const signedBody = TxBody.decode(this.#decode(signed.bodyBytes));

    tx.gas = {
      ...signedAuthInfo.fee,
      amount: signedAuthInfo.fee?.amount.map(coin => Cosmos.coin(coin.amount, coin.denom)) ?? tx.gas?.amount ?? [],
      gasLimit: signedAuthInfo.fee?.gasLimit ?? tx.gas?.gasLimit ?? 0n,
    };
    tx.memo = signedBody.memo;
    tx.timeoutHeight = signedBody.timeoutHeight;
    tx.setSignature(network, this, this.#decode(signature.signature));
    return tx;
  }

  async broadcast(tx: CosmosTx): Promise<string> {
    return await Cosmos.broadcast(tx.network!, tx);
  }

  protected async getAccounts(network: NetworkConfig): Promise<{ address: string; publicKey: PublicKey; }[]> {
    if (!this.#session) throw new WalletConnectSignerNotConnectedError();
    const client = await this.#signClient;
    const { topic } = this.#session;
    const accounts = await client.request<PeerAccount[]>({
      topic,
      chainId: 'cosmos:' + network.chainId,
      request: {
        method: 'cosmos_getAccounts',
        params: [],
      },
    });
    return accounts.map(acc => {
      if (!['secp256k1', 'ed25519'].includes(acc.algo))
        throw new WalletConnectSignerError(`Unsupported algo: ${acc.algo}`);
      const publicKey = acc.algo === 'secp256k1' ? pubkey.secp256k1(this.#decode(acc.pubkey)) : pubkey.ed25519(this.#decode(acc.pubkey));
      return { address: acc.address, publicKey };
    });
  }

  protected async getPublicKeys(networks: CosmosNetworkConfig[]) {
    const accs = await Promise.all(networks.map(network => this.getAccounts(network))).then(accs => accs.flat());
    const result: Record<string, PublicKey> = {};
    for (const { publicKey } of accs) {
      const bs = typeof publicKey.bytes === 'string' ? publicKey.bytes : toBase64(publicKey.bytes);
      const key = `${publicKey.type}:${bs}`;
      result[key] = publicKey;
    }
    return Object.values(result);
  }

  async updateSignData(networks = this.#networks) {
    const accs = this.accounts.value;
    await Promise.all(accs.map(async acc => {
      await Promise.all(networks.map(async network => {
        const data = acc.getSignData(network);
        const info = await Cosmos.getAccountInfo(network, data.peek().address);
        acc.setSignData(network, info.accountNumber, info.sequence);
      }));
    }));
  }

  #encode = (data: Uint8Array) => encode(data, this.config.encoding);
  #decode = (data: string) => decode(data, this.config.encoding);

  static async updateAll() {
    for (const signer of getSigners()) {
      await signer.updateSignData();
    }
  }
}

function encode(data: Uint8Array, encoding: WalletConnectSignerConfig['encoding'] = 'base64') {
  if (encoding === 'base64') return toBase64(data);
  if (encoding === 'hex') return toHex(data);
  throw new WalletConnectSignerError(`Unsupported encoding: ${encoding}`);
}

function decode(data: string, encoding: WalletConnectSignerConfig['encoding'] = 'base64') {
  if (encoding === 'base64') return fromBase64(data);
  if (encoding === 'hex') return fromHex(data);
  throw new WalletConnectSignerError(`Unsupported encoding: ${encoding}`);
}

// periodically refresh sign data
setTimeout(WalletConnectCosmosSigner.updateAll, 30000);

function getSigners() {
  const result: WalletConnectCosmosSigner[] = [];
  for (const ref of signers) {
    const signer = ref.deref();
    if (signer) {
      result.push(signer);
    } else {
      signers.delete(ref);
    }
  }
  return result;
}
