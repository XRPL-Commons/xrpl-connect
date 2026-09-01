import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { WalletManager } from '@xrpl-connect/core';
import {
  WALLET_CONNECTOR_CSS_VARIABLES,
  WALLET_CONNECTOR_PARTS,
  WALLET_CONNECTOR_PORTAL_ATTRIBUTES,
  WALLET_CONNECTOR_PORTAL_SELECTORS,
} from '../src/customization';
import { mainStyles } from '../src/styles/main';
import { renderAccountModal } from '../src/views/AccountModal';
import '../src/wallet-connector';

function partNames(root: ParentNode): string[] {
  return [...root.querySelectorAll('[part]')]
    .flatMap((element) => element.getAttribute('part')?.split(/\s+/) ?? [])
    .sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('wallet connector customization contract', () => {
  it('keeps the public variable list aligned with stylesheet defaults and consumers', () => {
    const declaredVariables = [...mainStyles.matchAll(/^\s+(--xc-[\w-]+):/gm)].map(
      ([, variable]) => variable
    );

    expect(declaredVariables).toEqual(WALLET_CONNECTOR_CSS_VARIABLES);
    for (const variable of WALLET_CONNECTOR_CSS_VARIABLES) {
      const occurrences = mainStyles.match(new RegExp(escapeRegExp(variable), 'g'))?.length ?? 0;
      expect(
        occurrences,
        `${variable} must be consumed outside its default declaration`
      ).toBeGreaterThan(1);
    }
  });

  it('forwards every supported variable, but not unknown variables, to both portals', async () => {
    const connector = document.createElement('xrpl-wallet-connector') as HTMLElement & {
      setWalletManager(manager: WalletManager): void;
      open(): Promise<void>;
      close(): void;
      openAccountModal(): void;
      closeAccountModal(): void;
      disconnectedCallback(): void;
      getOverlayRoot(): ShadowRoot | null;
      getAccountModalRoot(): ShadowRoot | null;
    };
    connector.setWalletManager(new WalletManager({ adapters: [] }));
    WALLET_CONNECTOR_CSS_VARIABLES.forEach((variable, index) => {
      connector.style.setProperty(variable, `contract-value-${index}`);
    });
    connector.style.setProperty('--xc-primary-colro', 'unsupported');
    document.body.appendChild(connector);

    try {
      await connector.open();
      connector.openAccountModal();

      for (const root of [connector.getOverlayRoot(), connector.getAccountModalRoot()]) {
        const portalHost = root?.host as HTMLElement;
        WALLET_CONNECTOR_CSS_VARIABLES.forEach((variable, index) => {
          expect(portalHost.style.getPropertyValue(variable)).toBe(`contract-value-${index}`);
        });
        expect(portalHost.style.getPropertyValue('--xc-primary-colro')).toBe('');
      }

      expect(document.querySelector(WALLET_CONNECTOR_PORTAL_SELECTORS.wallet)).not.toBeNull();
      expect(document.querySelector(WALLET_CONNECTOR_PORTAL_SELECTORS.account)).not.toBeNull();
      expect(connector.getOverlayRoot()?.host.parentElement).toBe(document.body);
      expect(connector.getAccountModalRoot()?.host.parentElement).toBe(document.body);

      connector.close();
      connector.closeAccountModal();
      expect(connector.getOverlayRoot()?.innerHTML).toBe('');
      expect(connector.getAccountModalRoot()?.innerHTML).toBe('');

      connector.remove();
      expect(document.querySelector(WALLET_CONNECTOR_PORTAL_SELECTORS.wallet)).toBeNull();
      expect(document.querySelector(WALLET_CONNECTOR_PORTAL_SELECTORS.account)).toBeNull();
    } finally {
      connector.remove();
    }
  });

  it('keeps runtime shadow parts aligned with the public part metadata', async () => {
    const connector = document.createElement('xrpl-wallet-connector') as HTMLElement & {
      shadowRoot: ShadowRoot;
      setWalletManager(manager: WalletManager): void;
      open(): Promise<void>;
      disconnectedCallback(): void;
      getOverlayRoot(): ShadowRoot | null;
    };
    connector.setWalletManager(new WalletManager({ adapters: [] }));
    document.body.appendChild(connector);

    try {
      await connector.open();
      expect(partNames(connector.shadowRoot)).toEqual(
        Object.values(WALLET_CONNECTOR_PARTS.connector)
      );
      expect(partNames(connector.getOverlayRoot()!)).toEqual(
        Object.values(WALLET_CONNECTOR_PARTS.walletModal).sort()
      );

      const accountMarkup = document.createElement('div');
      accountMarkup.innerHTML = renderAccountModal(
        { address: 'rAccount' },
        '1',
        (address) => address,
        () => ({ color1: '#000000', color2: '#ffffff' })
      );
      expect(partNames(accountMarkup)).toEqual(
        Object.values(WALLET_CONNECTOR_PARTS.accountModal).sort()
      );
    } finally {
      connector.disconnectedCallback();
      connector.remove();
    }
  });

  it('keeps canonical documentation aligned with variables, portals, and parts', () => {
    const documentation = readFileSync(
      resolve(process.cwd(), '../../docs/guide/customization.md'),
      'utf8'
    );
    const variableSection = documentation
      .split('## Available CSS Variables')[1]
      ?.split('### Typed overrides')[0];
    const documentedVariables = [...(variableSection?.matchAll(/`(--xc-[\w-]+)`/g) ?? [])].map(
      ([, variable]) => variable
    );

    expect([...new Set(documentedVariables)].sort()).toEqual(
      [...WALLET_CONNECTOR_CSS_VARIABLES].sort()
    );
    const documentedPart = (host: string, part: string) =>
      new RegExp(
        `\\|\\s*\\\`${escapeRegExp(host)}\\\`\\s*\\|\\s*\\\`::part\\(${escapeRegExp(part)}\\)\\\`\\s*\\|`
      );
    for (const part of Object.values(WALLET_CONNECTOR_PARTS.connector)) {
      expect(documentation).toMatch(documentedPart('xrpl-wallet-connector', part));
    }
    for (const [portal, parts] of [
      [WALLET_CONNECTOR_PORTAL_SELECTORS.wallet, WALLET_CONNECTOR_PARTS.walletModal],
      [WALLET_CONNECTOR_PORTAL_SELECTORS.account, WALLET_CONNECTOR_PARTS.accountModal],
    ] as const) {
      for (const part of Object.values(parts)) {
        expect(documentation).toMatch(documentedPart(portal, part));
      }
    }
  });

  it('documents both portal hosts as direct body-level siblings', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const shadowTree = readme.split('### Shadow DOM Structure')[1]?.split('### Styling')[0] ?? '';
    const connectorClose = shadowTree.indexOf('</xrpl-wallet-connector>');
    const portalLines = shadowTree
      .split('\n')
      .filter((line) =>
        Object.values(WALLET_CONNECTOR_PORTAL_ATTRIBUTES).some((attribute) =>
          line.includes(attribute)
        )
      );
    const expectedPortalLines = Object.values(WALLET_CONNECTOR_PORTAL_ATTRIBUTES).map(
      (attribute) => `<div ${attribute}>`
    );

    expect(connectorClose).toBeGreaterThanOrEqual(0);
    expect(portalLines).toEqual(expectedPortalLines);
    for (const portalLine of portalLines) {
      expect(shadowTree.indexOf(portalLine)).toBeGreaterThan(connectorClose);
    }
  });
});
