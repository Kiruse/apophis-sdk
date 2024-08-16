import React from 'preact/compat';

export interface IconBaseProps {
  children?: React.ReactNode;
  class?: string;
  style?: React.CSSProperties;
  onClick?(): void;
}

export default function IconBase({
  children,
  ...props
}: Readonly<IconBaseProps>) {
  return (
    <span {...props} class='cryptome-icon' style={{ cursor: props.onClick && 'pointer', ...props.style }}>
      {children}
    </span>
  );
}

if (globalThis.window) {
  window.document.head.appendChild(document.createElement('style')).textContent = `
    .cryptome-icon svg {
      display: inline-block;
      vertical-align: middle;
      height: 1.1em;
    }
  `;
}
