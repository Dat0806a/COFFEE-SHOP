import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Category,
  Product,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  AdminNotification,
  SalesTransaction,
  SalesTransactionItem,
  getOrderActivityTimestamp
} from '../types';
import { storeService, AppendOrderParams } from '../services/storeService';
import { soundService } from '../services/soundService';
import { adminNotificationService } from '../services/adminNotificationService';

export interface CustomerToastItem {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: number;
  status: OrderStatus;
  message: string;
}

interface StoreContextType {
  categories: Category[];
  products: Product[];
  orders: OrderRecord[];
  activeOrders: OrderRecord[];
  newOrdersCount: number;
  newOrderNotifications: OrderRecord[];
  dismissNotification: (orderId?: string) => void;

  // Admin Realtime Notifications
  adminNotifications: AdminNotification[];
  adminUnreadCount: number;
  markAdminNotificationRead: (id: string) => Promise<void>;
  markAllAdminNotificationsRead: () => Promise<void>;
  adminNotificationToasts: AdminNotification[];
  dismissAdminNotificationToast: (id: string) => void;
  
  // Customer Toasts for Table
  customerToasts: CustomerToastItem[];
  dismissCustomerToast: (toastId: string) => void;

  // Order Detail Modal State (Admin)
  selectedOrderIdForDetail: string | null;
  openOrderDetail: (orderId: string) => void;
  closeOrderDetail: () => void;

  // Customer Order Detail Modal State
  selectedCustomerOrderId: string | null;
  openCustomerOrderDetail: (orderId: string) => void;
  closeCustomerOrderDetail: () => void;

  // Customer Edit Order State
  editingOrderId: string | null;
  setEditingOrderId: (orderId: string | null) => void;
  
  // Realtime & Actions
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => Product | null;
  deleteProduct: (id: string) => boolean;
  toggleProductAvailability: (id: string) => Product | null;
  
  addCategory: (category: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => Category | null;
  deleteCategory: (id: string) => { success: boolean; message?: string };
  
  createCustomerOrder: (params: {
    tableNumber: number;
    tableName: string;
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    note?: string;
    voucherCode?: string;
    paymentMethod?: PaymentMethod;
    paymentProofPath?: string;
    paymentSubmittedAt?: string;
    items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  }) => Promise<OrderRecord>;
  
  updateCustomerOrder: (
    orderId: string,
    params: {
      subtotal: number;
      discount: number;
      shippingFee: number;
      total: number;
      note?: string;
      voucherCode?: string;
      items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
    }
  ) => Promise<{ success: boolean; order?: OrderRecord; error?: string }>;

  cancelCustomerOrder: (orderId: string) => Promise<{ success: boolean; error?: string }>;

  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<OrderRecord | null>;
  refreshStore: () => void;
  fetchOrderById: (orderId: string) => Promise<OrderRecord | null>;
  getTableOrders: (tableNumber: number) => OrderRecord[];
  getTableOpenOrder: (tableNumber: number) => OrderRecord | null;
  submitCustomerCart: (params: {
    tableNumber: number;
    tableName: string;
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    note?: string;
    voucherCode?: string;
    paymentMethod?: PaymentMethod;
    paymentProofPath?: string;
    paymentSubmittedAt?: string;
    items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  }) => Promise<{ order: OrderRecord; isAppended: boolean; wasConfirmed?: boolean }>;

  appendItemsToOrder: (params: AppendOrderParams) => Promise<{ success: boolean; order?: OrderRecord; wasConfirmed?: boolean; error?: string }>;

  // Payment APIs
  uploadPaymentProof: (orderId: string, file: File, paymentId?: string) => Promise<{ success: boolean; proofUrl?: string; error?: string }>;
  verifyPayment: (orderId: string, paymentId?: string, verifiedBy?: string) => Promise<{ success: boolean; order?: OrderRecord; error?: string }>;
  rejectPayment: (orderId: string, paymentId?: string, reason?: string) => Promise<{ success: boolean; order?: OrderRecord; error?: string }>;
  adminPaySelectedItems: (orderId: string, itemIds: string[], paymentMethod?: PaymentMethod, verifiedBy?: string) => Promise<{ success: boolean; order?: OrderRecord; error?: string }>;
  adminPayAllRemainingItems: (orderId: string, paymentMethod?: PaymentMethod, verifiedBy?: string) => Promise<{ success: boolean; order?: OrderRecord; error?: string }>;

  // Sales Ledger APIs
  salesTransactions: SalesTransaction[];
  salesTransactionItems: SalesTransactionItem[];
  confirmSale: (params: {
    orderId: string;
    itemIds?: string[];
    paymentId?: string;
    paymentMethod?: PaymentMethod;
    verifiedBy?: string;
  }) => Promise<{ success: boolean; transactionId?: string; recordedAmount?: number; recordedItemsCount?: number; error?: string }>;
  fetchSalesLedger: () => Promise<{ transactions: SalesTransaction[]; items: SalesTransactionItem[] }>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>(() => storeService.getCategories());
  const [products, setProducts] = useState<Product[]>(() => storeService.getProducts());
  const [orders, setOrders] = useState<OrderRecord[]>(() => storeService.getOrders());
  const [salesTransactions, setSalesTransactions] = useState<SalesTransaction[]>(() => storeService.getSalesTransactions());
  const [salesTransactionItems, setSalesTransactionItems] = useState<SalesTransactionItem[]>(() => storeService.getSalesTransactionItems());
  const [newOrderNotifications, setNewOrderNotifications] = useState<OrderRecord[]>([]);
  const [customerToasts, setCustomerToasts] = useState<CustomerToastItem[]>([]);
  const [selectedOrderIdForDetail, setSelectedOrderIdForDetail] = useState<string | null>(null);
  const [selectedCustomerOrderId, setSelectedCustomerOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>(() =>
    adminNotificationService.getNotifications()
  );
  const [adminUnreadCount, setAdminUnreadCount] = useState<number>(() =>
    adminNotificationService.getUnreadCount()
  );
  const [adminNotificationToasts, setAdminNotificationToasts] = useState<AdminNotification[]>([]);

  // Set of order IDs that have already triggered admin chime in this session
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());
  // Map of known order statuses to detect transitions for customer toasts
  const lastKnownStatusesRef = useRef<Map<string, OrderStatus>>(new Map());
  // Map of known payment statuses to detect payment transitions
  const lastKnownPaymentStatusesRef = useRef<Map<string, PaymentStatus>>(new Map());

  const refreshStore = useCallback(() => {
    setCategories(storeService.getCategories());
    setProducts(storeService.getProducts());
    setOrders(storeService.getOrders());
  }, []);

  useEffect(() => {
    // Initial fetch from Supabase table if available
    adminNotificationService.fetchNotifications().then(items => {
      if (items && items.length > 0) {
        setAdminNotifications(items);
        setAdminUnreadCount(adminNotificationService.getUnreadCount());
      }
    });

    const unsubNotif = adminNotificationService.subscribe((notif, isRealtimePush) => {
      setAdminNotifications(adminNotificationService.getNotifications());
      if (isRealtimePush) {
        setAdminNotificationToasts(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
      }
    });

    const unsubUnread = adminNotificationService.subscribeUnread((count) => {
      setAdminUnreadCount(count);
    });

    return () => {
      unsubNotif();
      unsubUnread();
    };
  }, []);

  const markAdminNotificationRead = useCallback(async (id: string) => {
    await adminNotificationService.markAsRead(id);
    setAdminNotifications(adminNotificationService.getNotifications());
    setAdminUnreadCount(adminNotificationService.getUnreadCount());
  }, []);

  const markAllAdminNotificationsRead = useCallback(async () => {
    await adminNotificationService.markAllAsRead();
    setAdminNotifications(adminNotificationService.getNotifications());
    setAdminUnreadCount(0);
  }, []);

  const dismissAdminNotificationToast = useCallback((id: string) => {
    setAdminNotificationToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const openOrderDetail = useCallback((orderIdOrNumber: string) => {
    const all = storeService.getOrders();
    const found = all.find(o => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber);
    setSelectedOrderIdForDetail(found ? found.id : orderIdOrNumber);
  }, []);

  useEffect(() => {
    // Ensure Supabase realtime listener is active
    storeService.initSupabaseRealtime();

    // Initial fetch to sync orders from database or local storage
    storeService.fetchOrders().then(loadedOrders => {
      if (loadedOrders && loadedOrders.length > 0) {
        setOrders(loadedOrders);
        loadedOrders.forEach(o => {
          lastKnownStatusesRef.current.set(o.id, o.status);
          lastKnownPaymentStatusesRef.current.set(o.id, o.paymentStatus);
          // Mark already existing orders as notified so initial load does not trigger sound
          notifiedOrderIdsRef.current.add(o.id);
        });
      }
    });

    const applyOrdersUpdate = (freshOrders: OrderRecord[]) => {
      freshOrders.forEach((order) => {
        const prevStatus = lastKnownStatusesRef.current.get(order.id);
        const prevPayStatus = lastKnownPaymentStatusesRef.current.get(order.id);

        // 1. Status change handling (specifically READY sound trigger on user side)
        if (order.status === 'READY' && prevStatus !== 'READY') {
          soundService.playReadySound(order.id);
          const toastItem: CustomerToastItem = {
            id: `toast-ready-${Date.now()}-${order.id}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            tableNumber: order.tableNumber,
            status: 'READY',
            message: `🎉 Đơn #${order.orderNumber} đã sẵn sàng phục vụ`
          };
          setCustomerToasts((prev) => [toastItem, ...prev.filter((t) => t.orderId !== order.id).slice(0, 4)]);
        } else if (prevStatus && prevStatus !== order.status) {
          let msg = '';
          if (order.status === 'CONFIRMED') msg = `Quán đã nhận đơn #${order.orderNumber}`;
          else if (order.status === 'PREPARING') msg = `Đơn #${order.orderNumber} đang được chuẩn bị`;
          else if (order.status === 'COMPLETED') msg = `Đơn #${order.orderNumber} đã hoàn thành. Chúc bạn ngon miệng!`;
          else if (order.status === 'CANCELLED') msg = `Đơn #${order.orderNumber} đã bị hủy`;

          if (msg) {
            const toastItem: CustomerToastItem = {
              id: `toast-${Date.now()}-${order.id}`,
              orderId: order.id,
              orderNumber: order.orderNumber,
              tableNumber: order.tableNumber,
              status: order.status,
              message: msg
            };
            setCustomerToasts((prev) => [toastItem, ...prev.filter((t) => t.orderId !== order.id).slice(0, 4)]);
          }
        }

        // 2. Customer payment status change toasts
        if (prevPayStatus && prevPayStatus !== order.paymentStatus) {
          let payMsg = '';
          if (order.paymentStatus === 'PAID') {
            payMsg = `✓ Thanh toán đơn #${order.orderNumber} đã được quán xác nhận!`;
          } else if (order.paymentStatus === 'REJECTED') {
            payMsg = `❌ Ảnh thanh toán đơn #${order.orderNumber} chưa được xác nhận. Vui lòng gửi lại.`;
          }

          if (payMsg) {
            const toastItem: CustomerToastItem = {
              id: `toast-pay-${Date.now()}-${order.id}`,
              orderId: order.id,
              orderNumber: order.orderNumber,
              tableNumber: order.tableNumber,
              status: order.status,
              message: payMsg
            };
            setCustomerToasts((prev) => [toastItem, ...prev.slice(0, 4)]);
          }
        }

        lastKnownStatusesRef.current.set(order.id, order.status);
        lastKnownPaymentStatusesRef.current.set(order.id, order.paymentStatus);
      });

      setOrders(freshOrders);
    };

    // Subscribe to realtime orders
    const unsubscribe = storeService.subscribeToOrders((order, isNew) => {
      // 1. Admin notification for NEW orders
      if (isNew && order.status === 'NEW') {
        if (!notifiedOrderIdsRef.current.has(order.id)) {
          notifiedOrderIdsRef.current.add(order.id);

          soundService.playNewOrderSound(order.id);
          
          setNewOrderNotifications(prev => {
            if (prev.some(o => o.id === order.id)) return prev;
            return [order, ...prev];
          });
        }
      }

      // 2. Admin notification for PAYMENT PROOF submission (VERIFYING)
      const prevPayStatus = lastKnownPaymentStatusesRef.current.get(order.id);
      if (order.paymentStatus === 'VERIFYING' && prevPayStatus !== 'VERIFYING') {
        soundService.playNewOrderSound(`proof-${order.id}-${order.paymentSubmittedAt || Date.now()}`);
        setNewOrderNotifications(prev => {
          if (prev.some(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      }

      applyOrdersUpdate(storeService.getOrders());
    });

    const unsubSales = storeService.subscribeToSales((txs) => {
      setSalesTransactions(txs);
      setSalesTransactionItems(storeService.getSalesTransactionItems());
    });

    // Periodic polling to guarantee 100% synchronization across tabs and devices
    const pollInterval = setInterval(() => {
      applyOrdersUpdate(storeService.getOrders());
    }, 1200);

    const onVisibilityOrFocus = () => {
      applyOrdersUpdate(storeService.getOrders());
      storeService.fetchOrders().then(fetched => {
        if (fetched) applyOrdersUpdate(fetched);
      });
      storeService.fetchSalesLedger();
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      unsubscribe();
      unsubSales();
      clearInterval(pollInterval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  const dismissNotification = useCallback((orderId?: string) => {
    if (!orderId) {
      setNewOrderNotifications([]);
      return;
    }
    setNewOrderNotifications(prev => prev.filter(o => o.id !== orderId));
  }, []);

  const dismissCustomerToast = useCallback((toastId: string) => {
    setCustomerToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);



  const closeOrderDetail = useCallback(() => {
    setSelectedOrderIdForDetail(null);
  }, []);

  const openCustomerOrderDetail = useCallback((orderId: string) => {
    setSelectedCustomerOrderId(orderId);
  }, []);

  const closeCustomerOrderDetail = useCallback(() => {
    setSelectedCustomerOrderId(null);
  }, []);

  const addProduct = useCallback((prod: Omit<Product, 'id'>) => {
    const created = storeService.addProduct(prod);
    setProducts(storeService.getProducts());
    return created;
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const updated = storeService.updateProduct(id, updates);
    setProducts(storeService.getProducts());
    return updated;
  }, []);

  const deleteProduct = useCallback((id: string) => {
    const deleted = storeService.deleteProduct(id);
    setProducts(storeService.getProducts());
    return deleted;
  }, []);

  const toggleProductAvailability = useCallback((id: string) => {
    const updated = storeService.toggleProductAvailability(id);
    setProducts(storeService.getProducts());
    return updated;
  }, []);

  const addCategory = useCallback((cat: Omit<Category, 'id'>) => {
    const created = storeService.addCategory(cat);
    setCategories(storeService.getCategories());
    return created;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    const updated = storeService.updateCategory(id, updates);
    setCategories(storeService.getCategories());
    return updated;
  }, []);

  const deleteCategory = useCallback((id: string) => {
    const res = storeService.deleteCategory(id);
    if (res.success) {
      setCategories(storeService.getCategories());
    }
    return res;
  }, []);

  const createCustomerOrder = useCallback(async (params: {
    tableNumber: number;
    tableName: string;
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    note?: string;
    voucherCode?: string;
    items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  }) => {
    const order = await storeService.createOrder(params);
    lastKnownStatusesRef.current.set(order.id, order.status);
    setOrders(storeService.getOrders());
    return order;
  }, []);

  const updateCustomerOrder = useCallback(async (
    orderId: string,
    params: {
      subtotal: number;
      discount: number;
      shippingFee: number;
      total: number;
      note?: string;
      voucherCode?: string;
      items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
    }
  ) => {
    const res = await storeService.updateCustomerOrder(orderId, params);
    setOrders(storeService.getOrders());
    return res;
  }, []);

  const cancelCustomerOrder = useCallback(async (orderId: string) => {
    const res = await storeService.cancelCustomerOrder(orderId);
    setOrders(storeService.getOrders());
    return res;
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const updated = await storeService.updateOrderStatus(orderId, status);
    if (updated) {
      lastKnownStatusesRef.current.set(updated.id, updated.status);
      if (status === 'READY') {
        soundService.playReadySound(orderId);
      }
    }
    setOrders(storeService.getOrders());
    return updated;
  }, []);

  const getTableOrders = useCallback((tableNumber: number) => {
    return orders.filter(o => o.tableNumber === tableNumber);
  }, [orders]);

  const getTableOpenOrder = useCallback((tableNumber: number) => {
    const found = orders
      .filter(o => o.tableNumber === tableNumber && o.status === 'NEW')
      .sort((a, b) => getOrderActivityTimestamp(b) - getOrderActivityTimestamp(a));
    return found[0] || null;
  }, [orders]);

  const uploadPaymentProof = useCallback(async (orderId: string, file: File, paymentId?: string) => {
    const res = await storeService.uploadPaymentProof(orderId, file, paymentId);
    if (res.success) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const verifyPayment = useCallback(async (orderId: string, paymentId?: string, verifiedBy = 'Admin') => {
    const res = await storeService.verifyPayment(orderId, paymentId, verifiedBy);
    if (res.success) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const rejectPayment = useCallback(async (orderId: string, paymentId?: string, reason?: string) => {
    const res = await storeService.rejectPayment(orderId, paymentId, reason);
    if (res.success) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const appendItemsToOrder = useCallback(async (params: AppendOrderParams) => {
    const res = await storeService.appendItemsToOrder(params);
    if (res.success && res.order) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const submitCustomerCart = useCallback(async (params: {
    tableNumber: number;
    tableName: string;
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    note?: string;
    voucherCode?: string;
    paymentMethod?: PaymentMethod;
    paymentProofPath?: string;
    paymentSubmittedAt?: string;
    items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  }): Promise<{ order: OrderRecord; isAppended: boolean; wasConfirmed?: boolean }> => {
    // 1. Check if table has an open order in NEW status
    const openOrder = storeService.getTableOpenOrder(params.tableNumber);

    if (openOrder && openOrder.status === 'NEW') {
      console.log('[STORE CONTEXT] Found open order for table:', openOrder.orderNumber, 'Appending items...');
      const res = await storeService.appendItemsToOpenOrder(openOrder.id, params.items, {
        note: params.note,
        voucherCode: params.voucherCode
      });

      if (res.success && res.order) {
        setOrders(storeService.getOrders());
        return { order: res.order, isAppended: true };
      }

      if (res.wasConfirmed) {
        console.log('[STORE CONTEXT] Open order was confirmed/locked in meantime. Creating new order instead...');
        // Open order was locked by Admin or already paid. Create a new order!
        const newOrd = await storeService.createOrder(params);
        setOrders(storeService.getOrders());
        return { order: newOrd, isAppended: false, wasConfirmed: true };
      }
    }

    // 2. No open order: Create brand new order
    console.log('[STORE CONTEXT] No open order. Creating brand new order...');
    const created = await storeService.createOrder(params);
    setOrders(storeService.getOrders());
    return { order: created, isAppended: false };
  }, []);

  const fetchOrderById = useCallback(async (orderId: string) => {
    const fetched = await storeService.fetchOrderById(orderId);
    if (fetched) {
      setOrders(storeService.getOrders());
    }
    return fetched;
  }, []);

  const adminPaySelectedItems = useCallback(async (
    orderId: string,
    itemIds: string[],
    paymentMethod: PaymentMethod = 'CASH',
    verifiedBy = 'Admin'
  ) => {
    const res = await storeService.adminPaySelectedItems(orderId, itemIds, paymentMethod, verifiedBy);
    if (res.success) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const adminPayAllRemainingItems = useCallback(async (
    orderId: string,
    paymentMethod: PaymentMethod = 'CASH',
    verifiedBy = 'Admin'
  ) => {
    const res = await storeService.adminPayAllRemainingItems(orderId, paymentMethod, verifiedBy);
    if (res.success) {
      setOrders(storeService.getOrders());
    }
    return res;
  }, []);

  const confirmSale = useCallback(async (params: {
    orderId: string;
    itemIds?: string[];
    paymentId?: string;
    paymentMethod?: PaymentMethod;
    verifiedBy?: string;
  }) => {
    const res = await storeService.confirmSale(params);
    if (res.success) {
      setOrders(storeService.getOrders());
      setSalesTransactions(storeService.getSalesTransactions());
      setSalesTransactionItems(storeService.getSalesTransactionItems());
    }
    return res;
  }, []);

  const fetchSalesLedger = useCallback(async () => {
    const res = await storeService.fetchSalesLedger();
    setSalesTransactions(res.transactions);
    setSalesTransactionItems(res.items);
    return res;
  }, []);

  const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const newOrdersCount = orders.filter(o => o.status === 'NEW').length;

  return (
    <StoreContext.Provider
      value={{
        categories,
        products,
        orders,
        activeOrders,
        newOrdersCount,
        newOrderNotifications,
        dismissNotification,
        adminNotifications,
        adminUnreadCount,
        markAdminNotificationRead,
        markAllAdminNotificationsRead,
        adminNotificationToasts,
        dismissAdminNotificationToast,
        customerToasts,
        dismissCustomerToast,
        selectedOrderIdForDetail,
        openOrderDetail,
        closeOrderDetail,
        selectedCustomerOrderId,
        openCustomerOrderDetail,
        closeCustomerOrderDetail,
        editingOrderId,
        setEditingOrderId,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductAvailability,
        addCategory,
        updateCategory,
        deleteCategory,
        createCustomerOrder,
        updateCustomerOrder,
        cancelCustomerOrder,
        updateOrderStatus,
        refreshStore,
        fetchOrderById,
        getTableOrders,
        getTableOpenOrder,
        submitCustomerCart,
        appendItemsToOrder,
        uploadPaymentProof,
        verifyPayment,
        rejectPayment,
        adminPaySelectedItems,
        adminPayAllRemainingItems,
        salesTransactions,
        salesTransactionItems,
        confirmSale,
        fetchSalesLedger
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

