import * as signals from '@apophis-sdk/core/signals.js';
import cx from 'classnames';
import React from 'preact/compat';
import CopyIcon from './icons/copy-icon.js';
import LogoutIcon from './icons/logout-icon.js';

export interface AddressProps {
  children?: string;
  placeholder?: string;
  extra?: React.ReactNode;
  /** Number of characters to keep from the front & end of the address each. Set to `0` or `Infinity` to keep all. */
  trimSize?: number;
  prefix?: string;
  prefixLength?: number;
  class?: string;
  style?: React.CSSProperties;
  noControls?: boolean;
  onCopy?(): void;
  onLogout?(): void;
}

export interface UserAddressProps extends Omit<AddressProps, 'children'> {
  onLogout?(): void;
}

export function Address({
  children,
  placeholder = 'n/a',
  extra,
  trimSize = 6,
  prefix,
  prefixLength,
  class: className,
  style,
  noControls,
  onCopy = () => { children && navigator.clipboard.writeText(children) },
}: Readonly<AddressProps>) {
  return (
    <span class={cx('cryptome-address', className)} style={style}>
      {trimAddress(children ?? placeholder, trimSize, getPrefixLength(prefix, prefixLength))}{' '}
      {!noControls && (
        <span class="cryptome-address-icons" style={{ display: 'inline-flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <CopyIcon onClick={onCopy} />
          {extra}
        </span>
      )}
    </span>
  )
}

export function UserAddress({
  onLogout = () => { signals.account.value = undefined },
  ...props
}: Readonly<Omit<AddressProps, 'children'>>) {
  return <Address
    {...props}
    extra={
      <>
        <LogoutIcon onClick={onLogout} />
        {props.extra}
      </>
    }
  >
    {signals.address.value}
  </Address>
}

/** Trim the given address, retaining `trimSize` characters from its start & end. `prefixLength`
 * characters are additionally kept from the start to accommodate bech32 prefixes.
 */
export function trimAddress(address: string, trimSize: number, prefixLength: number) {
  if (trimSize === 0 || trimSize === Infinity) return address;
  if (address.length <= prefixLength + 2 * trimSize) return address;
  return `${address.slice(0, prefixLength + trimSize)}…${address.slice(-trimSize)}`;
}

function getPrefixLength(prefix?: string, prefixLength?: number) {
  if (prefix) return prefix.length + 1; // +1 for the separator
  return prefixLength ?? 0;
}
