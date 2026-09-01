import type { AccountInfo } from '@xrpl-connect/core';
import {
  useWalletModal,
  type WalletConnectorElement,
  type WalletConnectorProps,
} from '../dist/index';

declare const connector: WalletConnectorElement;
declare const manager: Parameters<WalletConnectorElement['setWalletManager']>[0];

const managerResult: void = connector.setWalletManager(manager);
const openResult: Promise<void> = connector.open();
const accountResult: Promise<AccountInfo> = connector.openAndWait();
const closeResult: void = connector.close();
const toggleResult: void = connector.toggle();
const cssVarsProps: WalletConnectorProps = { cssVars: { '--xc-primary-color': '#7c3aed' } };
const invalidCssVarsProps: WalletConnectorProps = {
  cssVars: {
    // @ts-expect-error Unsupported or misspelled CSS variables are rejected.
    '--xc-primary-colro': '#7c3aed',
  },
};
const modal = null as unknown as ReturnType<typeof useWalletModal>;
const modalReady: boolean = modal.ready;
const modalOpen: Promise<void> = modal.open();
const modalAccount: Promise<AccountInfo> = modal.openAndWait();
const modalClose: void = modal.close();

// Implementation details must not leak into the public element contract.
// @ts-expect-error openAccountModal is internal to the web component implementation.
connector.openAccountModal();
// @ts-expect-error closeAccountModal is internal to the web component implementation.
connector.closeAccountModal();

void managerResult;
void openResult;
void accountResult;
void closeResult;
void toggleResult;
void cssVarsProps;
void invalidCssVarsProps;
void modalReady;
void modalOpen;
void modalAccount;
void modalClose;
