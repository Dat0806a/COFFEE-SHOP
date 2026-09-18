import React, { createContext, useContext, useState, useEffect } from 'react';
import { TableAccount } from '../types';
import { customerTables } from '../data/tables';

interface TableSessionContextType {
  currentTable: TableAccount | null;
  isTableSelected: boolean;
  selectTable: (tableNumber: number) => void;
  clearTableSession: () => void;
  sessionOrderIds: string[];
  addSessionOrderId: (orderId: string) => void;
  isOrderInSession: (orderId: string) => boolean;
}

const STORAGE_KEY = 'ana_current_table';

const TableSessionContext = createContext<TableSessionContextType | undefined>(undefined);

export const TableSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTable, setCurrentTable] = useState<TableAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const num = parseInt(saved, 10);
        const found = customerTables.find(t => t.tableNumber === num);
        return found || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [sessionOrderIds, setSessionOrderIds] = useState<string[]>(() => {
    try {
      const savedTable = localStorage.getItem(STORAGE_KEY);
      if (savedTable) {
        const savedOrders = localStorage.getItem(`ana_session_orders_table_${savedTable}`);
        if (savedOrders) return JSON.parse(savedOrders);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Sync sessionOrderIds when table changes
  useEffect(() => {
    if (currentTable) {
      try {
        const savedOrders = localStorage.getItem(`ana_session_orders_table_${currentTable.tableNumber}`);
        setSessionOrderIds(savedOrders ? JSON.parse(savedOrders) : []);
      } catch {
        setSessionOrderIds([]);
      }
    } else {
      setSessionOrderIds([]);
    }
  }, [currentTable?.tableNumber]);

  const addSessionOrderId = (orderId: string) => {
    if (!orderId) return;
    setSessionOrderIds(prev => {
      if (prev.includes(orderId)) return prev;
      const next = [...prev, orderId];
      if (currentTable) {
        try {
          localStorage.setItem(`ana_session_orders_table_${currentTable.tableNumber}`, JSON.stringify(next));
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

  const selectTable = (tableNumber: number) => {
    const found = customerTables.find(t => t.tableNumber === tableNumber);
    if (found) {
      setCurrentTable(found);
      try {
        localStorage.setItem(STORAGE_KEY, tableNumber.toString());
        const savedOrders = localStorage.getItem(`ana_session_orders_table_${tableNumber}`);
        setSessionOrderIds(savedOrders ? JSON.parse(savedOrders) : []);
      } catch {
        // ignore
      }
    }
  };

  const clearTableSession = () => {
    if (currentTable) {
      try {
        localStorage.removeItem(`ana_session_orders_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_active_order_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_cart_table_${currentTable.tableNumber}`);
        localStorage.removeItem(`ana_append_order_id_table_${currentTable.tableNumber}`);
      } catch {
        // ignore
      }
    }
    setCurrentTable(null);
    setSessionOrderIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <TableSessionContext.Provider
      value={{
        currentTable,
        isTableSelected: !!currentTable,
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
