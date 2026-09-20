import React, { createContext, useContext, useState, useEffect } from 'react';
import { TableAccount } from '../types';
import { customerTables } from '../data/tables';

interface TableSessionContextType {
  currentTable: TableAccount | null;
  orderSessionId: string | null;
  isTableSelected: boolean;
  selectTable: (tableNumber: number) => void;
  clearTableSession: () => void;
  sessionOrderIds: string[];
  addSessionOrderId: (orderId: string) => void;
  isOrderInSession: (orderId: string) => boolean;
}

const SESSION_KEYS = {
  ORDER_SESSION_ID: 'ana_order_session_id',
  SESSION_TABLE: 'ana_session_table',
  SESSION_ORDERS_PREFIX: 'ana_session_orders_'
};

const TableSessionContext = createContext<TableSessionContextType | undefined>(undefined);

export const TableSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read session ID from sessionStorage (preserves session on refresh, resets on new tab/login)
  const [orderSessionId, setOrderSessionId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return sessionStorage.getItem(SESSION_KEYS.ORDER_SESSION_ID) || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Current active table is only restored if active in current sessionStorage
  const [currentTable, setCurrentTable] = useState<TableAccount | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const savedTableNum = sessionStorage.getItem(SESSION_KEYS.SESSION_TABLE);
        const savedSessionId = sessionStorage.getItem(SESSION_KEYS.ORDER_SESSION_ID);
        if (savedTableNum && savedSessionId) {
          const num = parseInt(savedTableNum, 10);
          const found = customerTables.find(t => t.tableNumber === num);
          return found || null;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Orders placed strictly in THIS ordering session
  const [sessionOrderIds, setSessionOrderIds] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const savedSessionId = sessionStorage.getItem(SESSION_KEYS.ORDER_SESSION_ID);
        if (savedSessionId) {
          const raw = sessionStorage.getItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${savedSessionId}`);
          if (raw) return JSON.parse(raw);
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Sync sessionOrderIds if orderSessionId changes
  useEffect(() => {
    if (orderSessionId) {
      try {
        const raw = sessionStorage.getItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${orderSessionId}`);
        setSessionOrderIds(raw ? JSON.parse(raw) : []);
      } catch {
        setSessionOrderIds([]);
      }
    } else {
      setSessionOrderIds([]);
    }
  }, [orderSessionId]);

  const addSessionOrderId = (orderId: string) => {
    if (!orderId) return;
    setSessionOrderIds(prev => {
      if (prev.includes(orderId)) return prev;
      const next = [...prev, orderId];
      if (orderSessionId && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          sessionStorage.setItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${orderSessionId}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const isOrderInSession = (orderId: string) => {
    return sessionOrderIds.includes(orderId);
  };

  /**
   * User logs in / selects table:
   * ALWAYS creates a BRAND NEW ordering session (new orderSessionId).
   * Previous cart, previous order tracking, and previous orders are NOT restored.
   */
  const selectTable = (tableNumber: number) => {
    const found = customerTables.find(t => t.tableNumber === tableNumber);
    if (!found) return;

    // 1. Generate brand new unique ordering session ID
    const newSessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // 2. Clear any leftover session data from prior session
    if (orderSessionId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${orderSessionId}`);
        sessionStorage.removeItem(`ana_cart_session_${orderSessionId}`);
        sessionStorage.removeItem(`ana_active_order_session_${orderSessionId}`);
        sessionStorage.removeItem(`ana_append_order_id_session_${orderSessionId}`);
      } catch {
        // ignore
      }
    }

    // 3. Clear legacy localStorage keys to ensure complete isolation
    try {
      localStorage.removeItem('ana_current_table');
      localStorage.removeItem(`ana_session_orders_table_${tableNumber}`);
      localStorage.removeItem(`ana_active_order_table_${tableNumber}`);
      localStorage.removeItem(`ana_cart_table_${tableNumber}`);
      localStorage.removeItem(`ana_append_order_id_table_${tableNumber}`);
    } catch {
      // ignore
    }

    // 4. Set state for new session
    setOrderSessionId(newSessionId);
    setCurrentTable(found);
    setSessionOrderIds([]);

    // 5. Persist new session in sessionStorage (isolated per tab & session)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(SESSION_KEYS.ORDER_SESSION_ID, newSessionId);
        sessionStorage.setItem(SESSION_KEYS.SESSION_TABLE, tableNumber.toString());
        sessionStorage.setItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${newSessionId}`, JSON.stringify([]));
        sessionStorage.setItem(`ana_cart_session_${newSessionId}`, JSON.stringify([]));
      } catch {
        // ignore
      }
    }
  };

  /**
   * User logs out:
   * Clears the current ordering session completely on client.
   * Orders already submitted to system are PRESERVED in Store/Supabase for Admin.
   */
  const clearTableSession = () => {
    if (orderSessionId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`${SESSION_KEYS.SESSION_ORDERS_PREFIX}${orderSessionId}`);
        sessionStorage.removeItem(`ana_cart_session_${orderSessionId}`);
        sessionStorage.removeItem(`ana_active_order_session_${orderSessionId}`);
        sessionStorage.removeItem(`ana_append_order_id_session_${orderSessionId}`);
      } catch {
        // ignore
      }
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(SESSION_KEYS.ORDER_SESSION_ID);
        sessionStorage.removeItem(SESSION_KEYS.SESSION_TABLE);
      } catch {
        // ignore
      }
    }

    // Clear legacy localStorage keys
    try {
      localStorage.removeItem('ana_current_table');
      if (currentTable) {
        localStorage.removeItem(`ana_session_orders_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_active_order_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_cart_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_append_order_id_table_${currentTable.tableNumber}`);
      }
    } catch {
      // ignore
    }

    setCurrentTable(null);
    setOrderSessionId(null);
    setSessionOrderIds([]);
  };

  return (
    <TableSessionContext.Provider
      value={{
        currentTable,
        orderSessionId,
        isTableSelected: Boolean(currentTable && orderSessionId),
        selectTable,
        clearTableSession,
        sessionOrderIds,
        addSessionOrderId,
        isOrderInSession
      }}
    >
      {children}
    </TableSessionContext.Provider>
  );
};

export const useTableSession = () => {
  const context = useContext(TableSessionContext);
  if (!context) {
    throw new Error('useTableSession must be used within a TableSessionProvider');
  }
  return context;
};

