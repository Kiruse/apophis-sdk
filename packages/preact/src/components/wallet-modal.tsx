import cx from 'classnames';
import React from 'preact/compat';
import { WalletSelector, type WalletSelectorProps } from './wallet-selector.js';

const MODAL_ROOT = createModalRoot();

export function WalletModal(props: Readonly<WalletSelectorProps>) {
  return (
    <Modal class='cryptome-modal cryptome-wallet-modal'>
      <WalletSelector {...props} />
    </Modal>
  );
}

function Modal({ children, ...props }: { children?: React.ReactNode, class?: string, style?: React.CSSProperties }) {
  return React.createPortal(
    <div
      {...props}
      class={cx('cryptome-modal', props.class)}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        maxWidth: '60%',
        transform: 'translate(-50%, -50%)',
        ...props.style,
      }}
    >
      {children}
    </div>,
    MODAL_ROOT,
  );
}

function createModalRoot(): HTMLDivElement {
  if (!globalThis.document) return undefined as any;
  const elem = document.createElement('div');
  elem.classList.add('cryptome-wallet-modal-root');
  Object.assign(elem.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    'pointer-events': 'none',
    'z-index': 9999,
  });
  document.body.appendChild(elem);
  return elem;
}
