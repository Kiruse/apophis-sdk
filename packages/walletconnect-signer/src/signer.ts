import { type NetworkConfig } from '@apophis-sdk/core';
import { pubkey, PublicKey } from '@apophis-sdk/core/crypto/pubkey.js';
import { Cosmos, CosmosSigner, CosmosTx } from '@apophis-sdk/cosmos';
import { fromBase64, fromHex, toBase64, toHex } from '@apophis-sdk/core/utils.js';
import { SignClient as _SignClient } from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { type WalletConnectSignerConfig } from './config';
import { WalletConnectSignerError, WalletConnectSignerNotConnectedError } from './error';
import LOGO_DATA_URL from './logo';
import { prompt } from './prompt';
import { PeerAccount, SignClient, SignResponse } from './types.api';

export class WalletConnectCosmosSigner extends CosmosSigner {
  #client: Promise<SignClient>; // which is a Promise<SignClient> but they did the typing weird
  #session: SessionTypes.Struct | undefined;
  readonly type = 'walletconnect';
  readonly canAutoReconnect = true;
  readonly displayName = 'WalletConnect';
  readonly logoURL = LOGO_DATA_URL;

  constructor(public readonly config: WalletConnectSignerConfig) {
    super();
    this.available.value = true;
    this.#client = _SignClient.init({
      projectId: config.projectId,
      metadata: config.metadata,
    }).then(client => {
      client.on('session_update', (args) => {
        if (args.topic !== this.#session?.topic) return;
        this.#session.namespaces = args.params.namespaces;
      });
      // TODO: what happens when the session is deleted or expires?
      return client;
    });
  }

  probe() {
    // WalletConnect cannot deterministically tell if the user has any other remote wallets, so it's
    // always available.
    return Promise.resolve(true);
  }

  async connect(networks: NetworkConfig[]) {
    console.warn('CAVEAT: This version of the WalletConnect SignClient seems to be a buggy mess. I will keep an eye on new releases. Nonetheless, these errors should not prevent the integration from working.');
    const client = await this.#client;
    const session = await prompt(networks, client, this.config);
    this.#session = session;
    await this._initSignData(networks);
  }

  async disconnect() {
    const client = await this.#client;
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
    const client = await this.#client;
    const { topic } = this.#session;

    const signData = this.getSignData(network)[0];
    if (!signData) throw new WalletConnectSignerError('No sign data found');

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

    tx.gas = signedAuthInfo.fee;
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
    const client = await this.#client;
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

  #encode = (data: Uint8Array) => encode(data, this.config.encoding);
  #decode = (data: string) => decode(data, this.config.encoding);
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
