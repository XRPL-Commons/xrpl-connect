import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Event, StatusMessage } from '../types';

/**
 * Demo-only UI state (activity log + transient status banner). This is NOT part
 * of the wallet layer — connection/account state now comes from
 * `@xrpl-connect/react`'s `useWallet()`. Kept here purely to power the example's
 * event log and status messages.
 */
interface DemoContextType {
  events: Event[];
  statusMessage: StatusMessage | null;
  addEvent: (name: string, data: unknown) => void;
  clearEvents: () => void;
  showStatus: (message: string, type: StatusMessage['type']) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const addEvent = useCallback((name: string, data: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents((prev) => [{ timestamp, name, data }, ...prev]);
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const showStatus = useCallback((message: string, type: StatusMessage['type']) => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 5000);
  }, []);

  return (
    <DemoContext.Provider value={{ events, statusMessage, addEvent, clearEvents, showStatus }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
