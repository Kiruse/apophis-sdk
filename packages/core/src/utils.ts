import { ChainIDish } from './types';

export const getChainId = (network: ChainIDish) => typeof network === 'string' ? network : network.chainId;

export function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromHex(hex: string): Uint8Array {
  if (!hex.match(/^[0-9a-fA-F]+$/)) throw new Error('Invalid hex string');
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  return new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
}

export function toHex(bytes: Uint8Array): string {
  return bytes.reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '');
}
