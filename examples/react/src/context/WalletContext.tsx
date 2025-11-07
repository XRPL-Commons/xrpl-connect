import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { WalletManager } from '@xrpl-connect/core';
import type { Event, AccountInfo, StatusMessage } from '../types';

interface WalletContextType {
  walletManager: WalletManager | null;
  isConnected: boolean;
  accountInfo: AccountInfo | null;
  events: Event[];
  statusMessage: StatusMessage | null;
  setWalletManager: (manager: WalletManager) => void;
  setIsConnected: (connected: boolean) => void;
  setAccountInfo: (info: AccountInfo | null) => void;
  addEvent: (name: string, data: any) => void;
  clearEvents: () => void;
  showStatus: (message: string, type: StatusMessage['type']) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletManager, setWalletManagerState] = useState<WalletManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const setWalletManager = useCallback((manager: WalletManager) => {
    setWalletManagerState(manager);
  }, []);

  const addEvent = useCallback((name: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents((prev) => [{ timestamp, name, data }, ...prev]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const showStatus = useCallback((message: string, type: StatusMessage['type']) => {
    setStatusMessage({ message, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        walletManager,
        isConnected,
        accountInfo,
        events,
        statusMessage,
        setWalletManager,
        setIsConnected,
        setAccountInfo,
        addEvent,
        clearEvents,
        showStatus,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
