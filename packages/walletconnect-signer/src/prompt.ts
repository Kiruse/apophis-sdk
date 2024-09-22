import qr from 'qrcode';
import { type WalletConnectSignerConfig } from './config';

/** Router function for prompting a WalletConnect URI.
 *
 * - On mobile, it will try to open the URI as a universal link.
 * - In the browser, it creates a simple modal using minimal UI that you can manually style. Any
 *   wallet implementing the WalletConnect v2 protocol will be able to scan and process the QR code.
 *   It will also provide a hyperlink to the URI with a copy icon button which can both be used to
 *   interact with lesser common wallet setups, e.g. a desktop wallet app or a web wallet.
 * - In a terminal, it will print the URI to the console. Some consoles are capable of making the
 *   URI clickable. Some consoles are capable of rendering a QR code - though that is not yet
 *   supported here.
 * - In other cases, it throws an error.
 */
export function promptURI(uri: string, config: WalletConnectSignerConfig) {
  if (typeof navigator !== 'undefined') {
    if (/android/i.test(navigator.userAgent) || /iphone/i.test(navigator.userAgent)) {
      return promptMobile(uri, config);
    } else {
      return promptBrowser(uri, config);
    }
  } else if (typeof document !== 'undefined') {
    return promptBrowser(uri, config);
  } else if (typeof process !== 'undefined' && typeof process.stdout !== 'undefined') {
    return promptTerminal(uri, config);
  }
  throw new Error('Unsupported WalletConnect environment');
}

async function promptBrowser(uri: string, config: WalletConnectSignerConfig) {
  const modalRoot = document.createElement('div');
  let styles: any;
  modalRoot.classList.add('apophis-walletconnect-modal-backdrop');
  document.body.appendChild(modalRoot);
  modalRoot.addEventListener('click', e => {
    if (e.target === modalRoot) {
      document.body.removeChild(modalRoot);
      styles && document.head.removeChild(styles);
    }
  });

  const modal = document.createElement('div');
  modal.classList.add('apophis-modal', 'apophis-walletconnect-modal');
  config.modalClassName && modal.classList.add(config.modalClassName);
  modalRoot.appendChild(modal);

  modal.innerHTML = `
    <header class="apophis-walletconnect-modal-header">
      <h2>Connect with Wallet</h2>
    </header>
    <main class="apophis-walletconnect-modal-content"></main>
  `;

  const content = modal.querySelector('main')!;
  content.innerHTML = `
    <canvas class="apophis-walletconnect-qr"></canvas>
    <span>Scan the QR code with your wallet to connect</span>
    <span class="apophis-walletconnect-modal-separator">- OR -</span>
    <span class="apophis-walletconnect-modal-uri">
      <a href="${uri}" target="_blank">Tap here to connect</a>
    </span>
  `;

  const uriElement = modal.querySelector('.apophis-walletconnect-modal-uri')!;
  const copyIcon = iconCopy();
  uriElement.appendChild(copyIcon);
  copyIcon.addEventListener('click', () => {
    navigator.clipboard.writeText(uri);
    const checkIcon = iconCheck();
    copyIcon.replaceWith(checkIcon);
    setTimeout(() => {
      checkIcon.replaceWith(copyIcon);
    }, 5000);
  });

  const canvas = modal.querySelector('canvas')!;
  await qr.toCanvas(canvas, uri);

  if (!config.unstyled) {
    styles = document.createElement('style');
    styles.innerHTML = MODAL_CSS;
    document.head.appendChild(styles);
  }
}

function iconCopy() {
  // Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.
  const svg = createSvg('0 0 448 512', 20, 20);
  svg.classList.add('apophis-walletconnect-modal-icon', 'icon-copy');
  svg.innerHTML = `
    <path d="M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l140.1 0L400 115.9 400 320c0 8.8-7.2 16-16 16zM192 384l192 0c35.3 0 64-28.7 64-64l0-204.1c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1L192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-32-48 0 0 32c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l32 0 0-48-32 0z" fill="currentColor"/>
  `;
  return svg;
}

function iconCheck() {
  // Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.
  const svg = createSvg('0 0 448 512', 20, 20);
  svg.classList.add('apophis-walletconnect-modal-icon', 'icon-check');
  svg.innerHTML = `
    <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z" fill="currentColor"/>
  `;
  return svg;
}

function createSvg(viewbox: string, width: number, height: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', viewbox);
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());
  return svg;
}

async function promptMobile(uri: string, config: WalletConnectSignerConfig) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(uri);
  }
  location.assign(uri);
}

async function promptTerminal(uri: string, config: WalletConnectSignerConfig) {
  console.log(uri);
}

const MODAL_CSS = `
.apophis-walletconnect-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.apophis-walletconnect-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  max-width: 400px;
  background: white;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.5);
}

.apophis-walletconnect-modal-header h2 {
  text-align: center;
}

.apophis-walletconnect-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.apophis-walletconnect-modal canvas {
  display: inline-block;
  width: 100%;
  aspect-ratio: 1 / 1;
}

.apophis-walletconnect-modal-separator {
  font-size: 0.875rem;
  opacity: 0.6;
}

.apophis-walletconnect-modal-uri {
  a {
    text-decoration: none;
    color: cyan;

    &:hover {
      text-decoration: underline;
    }
  }

  svg {
    margin-left: 0.25em;
    vertical-align: middle;
  }

  .icon-copy {
    cursor: pointer;
  }

  .icon-check {
    color: #00B900;
  }
}
`;
