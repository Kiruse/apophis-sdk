import * as signals from '@apophis-sdk/core/signals.js';
import cx from 'classnames';
import React from 'preact/compat';
import CopyIcon from './icons/copy-icon.js';
import LogoutIcon from './icons/logout-icon.js';
import { addresses, trimAddress } from '@apophis-sdk/core';

export interface AddressProps {
  children?: string;
  placeholder?: string;
  extra?: React.ReactNode;
  /** Number of characters to keep from the front & end of the address each. Set to `0` or `Infinity` to keep all. */
  trimSize?: number;
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
  trimSize = 4,
  class: className,
  style,
  noControls,
  onCopy = () => { children && navigator.clipboard.writeText(children) },
}: Readonly<AddressProps>) {
  return (
    <span class={cx('apophis-address', className)} style={style}>
      {getLabel(children, placeholder, trimSize)}
      {!noControls && (
        <span class="apophis-address-icons" style={{ display: 'inline-flex', flexDirection: 'row', gap: 4, alignItems: 'center', paddingLeft: 4 }}>
          <CopyIcon onClick={onCopy} />
          {extra}
        </span>
      )}
    </span>
  )
}

export function UserAddress({
  onLogout = () => { signals.signer.value = undefined },
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

function getLabel(addr: string | undefined, placeholder: string, trimSize: number, aliasSize = trimSize * 2) {
  if (!addr) return placeholder;
  const alias = addresses.alias(addr);
  if (alias !== addr) return trimAlias(alias, aliasSize);
  return trimAddress(addr, trimSize);
}

function trimAlias(alias: string, trimSize: number) {
  if (alias.length <= trimSize) return alias;
  return alias.slice(0, trimSize) + '…';
}
