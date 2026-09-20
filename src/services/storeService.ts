import {
  Category,
  Product,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RevenueDayReport,
  TopProductSales,
  OrderPaymentRecord,
  SalesTransaction,
  SalesTransactionItem,
  MonthlyProductStat,
  MonthlyStatistics,
  getOrderPaidAmount,
  getOrderRemainingAmount,
  compareAdminOrders,
  getVietnamDateStr,
  getVietnamYearMonth,
  getVietnamCurrentMonth
} from '../types';
import { categories as initialCategories } from '../data/categories';
import { products as initialProducts } from '../data/products';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { adminNotificationService } from './adminNotificationService';

export interface AppendOrderParams {
  orderId: string;
  items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  deltaSubtotal: number;
  deltaDiscount?: number;
  deltaTotal: number;
  paymentMethod: PaymentMethod;
  paymentProofFile?: File | null;
  note?: string;
  voucherCode?: string;
}

const STORAGE_KEYS = {
  CATEGORIES: 'ana_db_categories',
  PRODUCTS: 'ana_db_products',
  ORDERS: 'ana_db_orders',
  ORDER_SEQ: 'ana_db_order_seq',
  SALES_TRANSACTIONS: 'ana_db_sales_transactions',
  SALES_TRANSACTION_ITEMS: 'ana_db_sales_transaction_items',
  MONTHLY_STATISTICS: 'ana_db_monthly_statistics'
};

type OrderListener = (order: OrderRecord, isNew: boolean) => void;
type TableStatusListener = (order: OrderRecord) => void;

class StoreService {
  private categories: Category[] = [];
  private products: Product[] = [];
  private orders: OrderRecord[] = [];
  private salesTransactions: SalesTransaction[] = [];
  private salesTransactionItems: SalesTransactionItem[] = [];
  private monthlyStatistics: MonthlyStatistics[] = [];
  private orderSeq: number = 1020;
  private orderListeners: Set<OrderListener> = new Set();
  private tableListeners: Map<number, Set<TableStatusListener>> = new Map();
  private salesListeners: Set<(transactions: SalesTransaction[]) => void> = new Set();
  private monthlyStatsListeners: Set<(stats: MonthlyStatistics[]) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isInitialized: boolean = false;
  private itemRefreshTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    this.initData();
    this.initBroadcast();
    this.initSupabaseRealtime();
    this.fetchSalesLedger();
    this.fetchMonthlyStatistics();
    this.runMonthlyCleanup();
  }

  private initData() {
    if (this.isInitialized) return;

    // Load categories
    try {
      const savedCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (savedCats) {
        this.categories = JSON.parse(savedCats);
      } else {
        this.categories = initialCategories.map((c, i) => ({
          ...c,
          displayOrder: i + 1,
          isActive: true
        }));
        this.saveCategories();
      }
    } catch {
      this.categories = [...initialCategories];
    }

    // Load products
    try {
      const savedProds = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (savedProds) {
        this.products = JSON.parse(savedProds);
      } else {
        this.products = initialProducts.map((p, i) => ({
          ...p,
          isAvailable: true,
          isFeatured: p.isPopular || false,
          isThaiSpecial: p.name.toLowerCase().includes('thái') || p.name.toLowerCase().includes('chiang mai'),
          displayOrder: i + 1,
          createdAt: new Date().toISOString()
        }));
        this.saveProducts();
      }
    } catch {
      this.products = [...initialProducts];
    }

    // Load orders
    try {
      const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const savedSeq = localStorage.getItem(STORAGE_KEYS.ORDER_SEQ);
      if (savedSeq) {
        this.orderSeq = parseInt(savedSeq, 10);
      } else {
        this.orderSeq = 1000;
      }

      if (savedOrders) {
        const parsed: OrderRecord[] = JSON.parse(savedOrders);
        // Purge any legacy fake/seeded dummy orders & ensure payments array
        this.orders = parsed.filter(o => !o.id.startsWith('ord-seed-')).map(o => {
          if (!o.payments || o.payments.length === 0) {
            o.payments = [{
              id: `pay-${o.id}-1`,
              orderId: o.id,
              batchNumber: 1,
              amount: o.total,
              paymentMethod: o.paymentMethod || 'CASH',
              paymentStatus: o.paymentStatus || 'PENDING',
              paymentProofPath: o.paymentProofPath,
              paymentSubmittedAt: o.paymentSubmittedAt,
              paymentVerifiedAt: o.paymentVerifiedAt,
              paymentVerifiedBy: o.paymentVerifiedBy,
              paymentRejectionReason: o.paymentRejectionReason,
              createdAt: o.createdAt,
              paidAt: o.paymentVerifiedAt
            }];
          }
          o.paidAmount = getOrderPaidAmount(o);
          o.remainingAmount = getOrderRemainingAmount(o);
          return o;
        });
        this.saveOrders();
      } else {
        this.orders = [];
        this.saveOrders();
      }
    } catch {
      this.orders = [];
    }

    // Load sales transactions
    try {
      const savedTxs = localStorage.getItem(STORAGE_KEYS.SALES_TRANSACTIONS);
      if (savedTxs) {
        this.salesTransactions = JSON.parse(savedTxs);
      }
    } catch {
      this.salesTransactions = [];
    }

    // Load sales transaction items
    try {
      const savedItems = localStorage.getItem(STORAGE_KEYS.SALES_TRANSACTION_ITEMS);
      if (savedItems) {
        this.salesTransactionItems = JSON.parse(savedItems);
      }
    } catch {
      this.salesTransactionItems = [];
    }

    // Load monthly statistics snapshot history
    try {
      const savedMonthlyStats = localStorage.getItem(STORAGE_KEYS.MONTHLY_STATISTICS);
      if (savedMonthlyStats) {
        this.monthlyStatistics = JSON.parse(savedMonthlyStats);
      }
    } catch {
      this.monthlyStatistics = [];
    }

    this.isInitialized = true;
  }

  public clearAllOrders() {
    this.orders = [];
    this.orderSeq = 1000;
    this.saveOrders();
    this.broadcastChannel?.postMessage({ type: 'SYNC_ORDERS', payload: [] });
  }

  private initBroadcast() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('ana_chiang_mai_sync');
      this.broadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'NEW_ORDER' && payload?.id) {
          const exists = this.orders.some(o => o.id === payload.id);
          this.orders = [payload, ...this.orders.filter(o => o.id !== payload.id)];
          this.saveOrders();
          this.notifyOrderListeners(payload, !exists);
          this.notifyTableListeners(payload);
        } else if ((type === 'UPDATE_ORDER_STATUS' || type === 'UPDATE_ORDER_CONTENT' || type === 'UPDATE_ORDER_PAYMENT') && payload?.id) {
          this.orders = [payload, ...this.orders.filter(o => o.id !== payload.id)];
          this.saveOrders();
          this.notifyOrderListeners(payload, false);
          this.notifyTableListeners(payload);
        } else if (type === 'SYNC_PRODUCTS') {
          this.products = payload;
        } else if (type === 'SYNC_CATEGORIES') {
          this.categories = payload;
        } else if (type === 'SYNC_SALES_LEDGER' && payload) {
          if (Array.isArray(payload.transactions)) {
            this.salesTransactions = payload.transactions;
          }
          if (Array.isArray(payload.items)) {
            this.salesTransactionItems = payload.items;
          }
          this.notifySalesListeners();
        } else if (type === 'SYNC_MONTHLY_STATISTICS' && Array.isArray(payload)) {
          this.monthlyStatistics = payload;
          this.notifyMonthlyStatsListeners();
        } else if (type === 'DELETE_ORDERS' && Array.isArray(payload?.orderIds)) {
          const deleteSet = new Set<string>(payload.orderIds);
          const deletedOrders = this.orders.filter(o => deleteSet.has(o.id));
          this.orders = this.orders.filter(o => !deleteSet.has(o.id));
          this.saveOrders();
          deletedOrders.forEach(ord => {
            try {
              const savedOrdersKey = `ana_session_orders_table_${ord.tableNumber}`;
              const savedOrdersStr = localStorage.getItem(savedOrdersKey);
              if (savedOrdersStr) {
                const arr = JSON.parse(savedOrdersStr);
                if (Array.isArray(arr)) {
                  const filtered = arr.filter((id: string) => id !== ord.id);
                  localStorage.setItem(savedOrdersKey, JSON.stringify(filtered));
                }
              }
              const activeKey = `ana_active_order_table_${ord.tableNumber}`;
              if (localStorage.getItem(activeKey) === ord.id) {
                localStorage.removeItem(activeKey);
              }
            } catch {
              // ignore
            }
            this.notifyOrderListeners(ord, false);
            this.notifyTableListeners(ord);
          });
        }
      };
    }

    // Cross-tab storage event backup
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.ORDERS && e.newValue) {
          try {
            const parsedOrders: OrderRecord[] = JSON.parse(e.newValue);
            if (Array.isArray(parsedOrders)) {
              const oldOrders = [...this.orders];
              this.orders = parsedOrders;
              parsedOrders.forEach((ord) => {
                const existing = oldOrders.find((o) => o.id === ord.id);
                if (!existing && ord.status === 'NEW') {
                  this.notifyOrderListeners(ord, true);
                  this.notifyTableListeners(ord);
                } else if (
                  existing &&
                  (existing.status !== ord.status ||
                    existing.total !== ord.total ||
                    existing.paymentStatus !== ord.paymentStatus ||
                    existing.items?.length !== ord.items?.length)
                ) {
                  this.notifyOrderListeners(ord, false);
                  this.notifyTableListeners(ord);
                }
              });
            }
          } catch {
            // ignore
          }
        } else if (e.key === STORAGE_KEYS.SALES_TRANSACTIONS && e.newValue) {
          try {
            const parsedTxs = JSON.parse(e.newValue);
            if (Array.isArray(parsedTxs)) {
              this.salesTransactions = parsedTxs;
              this.notifySalesListeners();
            }
          } catch {}
        } else if (e.key === STORAGE_KEYS.SALES_TRANSACTION_ITEMS && e.newValue) {
          try {
            const parsedItems = JSON.parse(e.newValue);
            if (Array.isArray(parsedItems)) {
              this.salesTransactionItems = parsedItems;
              this.notifySalesListeners();
            }
          } catch {}
        } else if (e.key === STORAGE_KEYS.MONTHLY_STATISTICS && e.newValue) {
          try {
            const parsedStats = JSON.parse(e.newValue);
            if (Array.isArray(parsedStats)) {
              this.monthlyStatistics = parsedStats;
              this.notifyMonthlyStatsListeners();
            }
          } catch {}
        }
      });
    }
  }

  private realtimeChannel: any = null;

  public initSupabaseRealtime() {
    if (!isSupabaseConfigured || !supabase) {
      console.log('[ADMIN REALTIME] Supabase not configured, skipping realtime channels');
      return;
    }

    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {
        // ignore
      }
    }

    console.log('[ADMIN REALTIME] Initializing Supabase Realtime for orders, order_items, sales ledger & monthly statistics...');
    this.realtimeChannel = supabase
      .channel('ana_admin_realtime_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          console.log('[ADMIN REALTIME] NEW ORDER INSERT event received:', payload);
          const raw = payload.new as Record<string, unknown>;
          const orderId = String(raw.id || '');
          if (!orderId) return;

          const exists = this.orders.some((o) => o.id === orderId);
          const freshOrder = await this.fetchOrderById(orderId);
          const formattedOrder: OrderRecord = freshOrder || {
            id: orderId,
            orderNumber: String(raw.order_number || `ANA-${Date.now().toString().slice(-4)}`),
            tableNumber: Number(raw.table_number || 1),
            tableName: String(raw.table_name || `Bàn số ${raw.table_number || 1}`),
            status: (raw.status as OrderStatus) || 'NEW',
            subtotal: Number(raw.subtotal || 0),
            discount: Number(raw.discount || 0),
            shippingFee: Number(raw.shipping_fee || 0),
            total: Number(raw.total || 0),
            items: [],
            paymentMethod: (raw.payment_method as PaymentMethod) || 'CASH',
            paymentStatus: (raw.payment_status as PaymentStatus) || 'PENDING',
            createdAt: String(raw.created_at || new Date().toISOString())
          };

          if (!exists) {
            this.orders = [formattedOrder, ...this.orders.filter(o => o.id !== orderId)];
          } else {
            this.orders = [formattedOrder, ...this.orders.filter(o => o.id !== orderId)];
          }
          this.saveOrders();
          this.notifyOrderListeners(formattedOrder, !exists);
          this.notifyTableListeners(formattedOrder);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          console.log('[ADMIN REALTIME] ORDER UPDATE event received:', payload);
          const raw = payload.new as Record<string, unknown>;
          const orderId = String(raw.id || '');
          if (!orderId) return;

          const refreshed = await this.fetchOrderById(orderId);
          if (refreshed) {
            this.orders = [refreshed, ...this.orders.filter(o => o.id !== orderId)];
            this.saveOrders();
            this.notifyOrderListeners(refreshed, false);
            this.notifyTableListeners(refreshed);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          const itemRaw = (payload.new || payload.old) as Record<string, unknown>;
          const orderId = String(itemRaw?.order_id || '');
          if (!orderId) return;

          console.log('[ADMIN REALTIME] ORDER_ITEMS change received for orderId:', orderId);
          if (this.itemRefreshTimers.has(orderId)) {
            clearTimeout(this.itemRefreshTimers.get(orderId));
          }

          const timer = setTimeout(async () => {
            this.itemRefreshTimers.delete(orderId);
            const refreshed = await this.fetchOrderById(orderId);
            if (refreshed) {
              this.notifyOrderListeners(refreshed, false);
              this.notifyTableListeners(refreshed);
            }
          }, 300);

          this.itemRefreshTimers.set(orderId, timer);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_transactions' },
        async () => {
          console.log('[ADMIN REALTIME] SALES_TRANSACTIONS change received');
          await this.fetchSalesLedger();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_transaction_items' },
        async () => {
          console.log('[ADMIN REALTIME] SALES_TRANSACTION_ITEMS change received');
          await this.fetchSalesLedger();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monthly_statistics' },
        async () => {
          console.log('[ADMIN REALTIME] MONTHLY_STATISTICS change received');
          await this.fetchMonthlyStatistics();
        }
      )
      .subscribe((status, err) => {
        console.log('[ADMIN REALTIME] Status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('[ADMIN REALTIME] ✅ SUBSCRIBED successfully to orders, items, sales ledger & monthly statistics');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[ADMIN REALTIME] ⚠️ Connection interrupted (' + status + '). Reconnecting...');
          setTimeout(() => {
            this.initSupabaseRealtime();
            this.fetchOrders();
            this.fetchSalesLedger();
            this.fetchMonthlyStatistics();
          }, 3000);
        }
      });
  }

  private saveCategories() {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
      this.broadcastChannel?.postMessage({ type: 'SYNC_CATEGORIES', payload: this.categories });
    } catch {
      // ignore
    }
  }

  private saveProducts() {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
      this.broadcastChannel?.postMessage({ type: 'SYNC_PRODUCTS', payload: this.products });
    } catch {
      // ignore
    }
  }

  private saveOrders() {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.ORDER_SEQ, this.orderSeq.toString());
    } catch {
      // ignore
    }
  }

  private saveSalesLedger() {
    try {
      localStorage.setItem(STORAGE_KEYS.SALES_TRANSACTIONS, JSON.stringify(this.salesTransactions));
      localStorage.setItem(STORAGE_KEYS.SALES_TRANSACTION_ITEMS, JSON.stringify(this.salesTransactionItems));
      this.broadcastChannel?.postMessage({
        type: 'SYNC_SALES_LEDGER',
        payload: {
          transactions: this.salesTransactions,
          items: this.salesTransactionItems
        }
      });
    } catch {
      // ignore
    }
  }

  // --- MONTHLY STATISTICS SNAPSHOT & SAFE CLEANUP API ---
  private saveMonthlyStatistics() {
    try {
      localStorage.setItem(STORAGE_KEYS.MONTHLY_STATISTICS, JSON.stringify(this.monthlyStatistics));
      this.broadcastChannel?.postMessage({
        type: 'SYNC_MONTHLY_STATISTICS',
        payload: this.monthlyStatistics
      });
      this.notifyMonthlyStatsListeners();
    } catch {
      // ignore
    }
  }

  public getMonthlyStatistics(): MonthlyStatistics[] {
    return [...this.monthlyStatistics].sort((a, b) => b.month.localeCompare(a.month));
  }

  public subscribeToMonthlyStats(listener: (stats: MonthlyStatistics[]) => void): () => void {
    this.monthlyStatsListeners.add(listener);
    listener(this.getMonthlyStatistics());
    return () => {
      this.monthlyStatsListeners.delete(listener);
    };
  }

  private notifyMonthlyStatsListeners() {
    const sorted = this.getMonthlyStatistics();
    this.monthlyStatsListeners.forEach(listener => {
      try {
        listener(sorted);
      } catch {
        // ignore
      }
    });
  }

  public async fetchMonthlyStatistics(): Promise<MonthlyStatistics[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('monthly_statistics')
          .select('*')
          .order('month', { ascending: false });

        if (!error && data && Array.isArray(data)) {
          const mapped: MonthlyStatistics[] = data.map((raw: any) => ({
            month: String(raw.month),
            revenue: Number(raw.revenue || 0),
            completedOrders: Number(raw.completed_orders || 0),
            itemsSold: Number(raw.items_sold || 0),
            averageOrderValue: Number(raw.average_order_value || 0),
            productStats: Array.isArray(raw.product_stats) ? raw.product_stats : [],
            createdAt: String(raw.created_at || new Date().toISOString()),
            updatedAt: String(raw.updated_at || new Date().toISOString())
          }));

          const map = new Map<string, MonthlyStatistics>();
          this.monthlyStatistics.forEach(s => map.set(s.month, s));
          mapped.forEach(s => map.set(s.month, s));
          this.monthlyStatistics = Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
          this.saveMonthlyStatistics();
          return this.monthlyStatistics;
        }
      } catch (err) {
        console.warn('[MONTHLY_STATS] Error fetching monthly statistics from Supabase:', err);
      }
    }
    return this.getMonthlyStatistics();
  }

  public getMonthlyStatsDetail(yearMonth: string): MonthlyStatistics {
    const snapshot = this.monthlyStatistics.find(s => s.month === yearMonth);
    const liveOrders = this.orders.filter(o => 
      o.status === 'COMPLETED' && o.completedAt && getVietnamYearMonth(o.completedAt) === yearMonth
    );

    if (liveOrders.length === 0 && snapshot) {
      return snapshot;
    }

    const liveRevenue = liveOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const liveCompletedCount = liveOrders.length;
    const liveItemsSold = liveOrders.reduce((sum, o) =>
      sum + o.items.reduce((isum, it) => isum + Number(it.quantity || 1), 0), 0
    );
    const liveAov = liveCompletedCount > 0 ? Math.round(liveRevenue / liveCompletedCount) : 0;

    const prodMap: Record<string, { id: string; name: string; category: string; image: string; qty: number; rev: number }> = {};
    
    if (snapshot?.productStats && liveOrders.length === 0) {
      snapshot.productStats.forEach(p => {
        prodMap[p.productId] = {
          id: p.productId,
          name: p.productName,
          category: p.category,
          image: p.image,
          qty: p.quantity,
          rev: p.revenue
        };
      });
    } else {
      liveOrders.forEach(o => {
        o.items.forEach(it => {
          if (!prodMap[it.productId]) {
            const found = this.products.find(p => p.id === it.productId);
            prodMap[it.productId] = {
              id: it.productId,
              name: it.productName,
              category: found?.category || 'menu',
              image: it.image || found?.image || '/coffee_img/1.png',
              qty: 0,
              rev: 0
            };
          }
          prodMap[it.productId].qty += Number(it.quantity || 1);
          prodMap[it.productId].rev += Number(it.totalPrice || (it.unitPrice * it.quantity));
        });
      });
    }

    const productStats: MonthlyProductStat[] = Object.values(prodMap)
      .sort((a, b) => b.qty - a.qty || b.rev - a.rev)
      .map(p => ({
        productId: p.id,
        productName: p.name,
        category: p.category,
        image: p.image,
        quantity: p.qty,
        revenue: p.rev
      }));

    if (snapshot && liveOrders.length === 0) {
      return snapshot;
    }

    return {
      month: yearMonth,
      revenue: Math.max(snapshot?.revenue || 0, liveRevenue),
      completedOrders: Math.max(snapshot?.completedOrders || 0, liveCompletedCount),
      itemsSold: Math.max(snapshot?.itemsSold || 0, liveItemsSold),
      averageOrderValue: Math.max(snapshot?.averageOrderValue || 0, liveAov),
      productStats: productStats.length > 0 ? productStats : (snapshot?.productStats || []),
      createdAt: snapshot?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  public async runMonthlyCleanup(): Promise<{ cleanedCount: number; snapshotsCreated: number }> {
    const currentMonthStr = getVietnamCurrentMonth();
    if (!currentMonthStr) return { cleanedCount: 0, snapshotsCreated: 0 };

    // 1. Identify ONLY orders where:
    //    - status === 'COMPLETED'
    //    - completedAt is present and in Vietnam timezone strictly < currentMonthStr
    // 2. Strict safety: NEVER delete any order where status !== 'COMPLETED' (NEW, CONFIRMED, PREPARING, READY, CANCELLED, etc.)
    // 3. Strict safety: NEVER delete any order completed in the current month!
    const oldCompletedOrders = this.orders.filter(o => {
      if (o.status !== 'COMPLETED' || !o.completedAt) return false;
      const orderMonthStr = getVietnamYearMonth(o.completedAt);
      return orderMonthStr !== '' && orderMonthStr < currentMonthStr;
    });

    if (oldCompletedOrders.length === 0) {
      return { cleanedCount: 0, snapshotsCreated: 0 };
    }

    const ordersByMonth: Record<string, OrderRecord[]> = {};
    oldCompletedOrders.forEach(o => {
      const mStr = getVietnamYearMonth(o.completedAt!);
      if (mStr && mStr < currentMonthStr) {
        if (!ordersByMonth[mStr]) ordersByMonth[mStr] = [];
        ordersByMonth[mStr].push(o);
      }
    });

    let snapshotsCreated = 0;
    const orderIdsToDelete: string[] = [];

    for (const [monthStr, monthOrders] of Object.entries(ordersByMonth)) {
      const existingSnapshot = this.monthlyStatistics.find(s => s.month === monthStr);

      const monthRevenue = monthOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const completedOrdersCount = monthOrders.length;
      const itemsSold = monthOrders.reduce((sum, o) => 
        sum + o.items.reduce((isum, it) => isum + Number(it.quantity || 1), 0), 0
      );
      const aov = completedOrdersCount > 0 ? Math.round(monthRevenue / completedOrdersCount) : 0;

      const prodMap: Record<string, { id: string; name: string; category: string; image: string; qty: number; rev: number }> = {};
      monthOrders.forEach(o => {
        o.items.forEach(it => {
          if (!prodMap[it.productId]) {
            const found = this.products.find(p => p.id === it.productId);
            prodMap[it.productId] = {
              id: it.productId,
              name: it.productName,
              category: found?.category || 'menu',
              image: it.image || found?.image || '/coffee_img/1.png',
              qty: 0,
              rev: 0
            };
          }
          prodMap[it.productId].qty += Number(it.quantity || 1);
          prodMap[it.productId].rev += Number(it.totalPrice || (it.unitPrice * it.quantity));
        });
      });

      const productStats: MonthlyProductStat[] = Object.values(prodMap)
        .sort((a, b) => b.qty - a.qty || b.rev - a.rev)
        .map(p => ({
          productId: p.id,
          productName: p.name,
          category: p.category,
          image: p.image,
          quantity: p.qty,
          revenue: p.rev
        }));

      const nowIso = new Date().toISOString();
      let snapshotToSave: MonthlyStatistics;

      if (existingSnapshot) {
        snapshotToSave = {
          ...existingSnapshot,
          revenue: Math.max(existingSnapshot.revenue, monthRevenue),
          completedOrders: Math.max(existingSnapshot.completedOrders, completedOrdersCount),
          itemsSold: Math.max(existingSnapshot.itemsSold, itemsSold),
          averageOrderValue: Math.max(existingSnapshot.averageOrderValue, aov),
          productStats: existingSnapshot.productStats.length > 0 ? existingSnapshot.productStats : productStats,
          updatedAt: nowIso
        };
      } else {
        snapshotToSave = {
          month: monthStr,
          revenue: monthRevenue,
          completedOrders: completedOrdersCount,
          itemsSold,
          averageOrderValue: aov,
          productStats,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        snapshotsCreated++;
      }

      let isSnapshotPersisted = false;
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('monthly_statistics').upsert({
            month: snapshotToSave.month,
            revenue: snapshotToSave.revenue,
            completed_orders: snapshotToSave.completedOrders,
            items_sold: snapshotToSave.itemsSold,
            average_order_value: snapshotToSave.averageOrderValue,
            product_stats: snapshotToSave.productStats,
            created_at: snapshotToSave.createdAt,
            updated_at: snapshotToSave.updatedAt
          }, { onConflict: 'month' });

          if (!error) {
            isSnapshotPersisted = true;
          } else {
            console.warn('[CLEANUP] Failed to upsert snapshot to Supabase:', error);
          }
        } catch (err) {
          console.warn('[CLEANUP] Supabase upsert exception:', err);
        }
      } else {
        isSnapshotPersisted = true;
      }

      this.monthlyStatistics = [
        snapshotToSave,
        ...this.monthlyStatistics.filter(s => s.month !== snapshotToSave.month)
      ].sort((a, b) => b.month.localeCompare(a.month));
      this.saveMonthlyStatistics();

      if (isSnapshotPersisted) {
        monthOrders.forEach(o => orderIdsToDelete.push(o.id));
      }
    }

    if (orderIdsToDelete.length > 0) {
      const deleteSet = new Set(orderIdsToDelete);
      this.orders = this.orders.filter(o => !deleteSet.has(o.id));
      this.saveOrders();

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('orders').delete().in('id', orderIdsToDelete);
          console.log(`[CLEANUP] Safely purged ${orderIdsToDelete.length} past completed orders after snapshot verification.`);
        } catch (err) {
          console.warn('[CLEANUP] Error purging old orders from Supabase:', err);
        }
      }
    }

    return { cleanedCount: orderIdsToDelete.length, snapshotsCreated };
  }

  /**
   * Auto-purge unaccepted orders after 1 hour (status === 'NEW' and now - createdAt >= 1 hour).
   * Safe, idempotent, preserves accepted/confirmed orders, and protects paid orders.
   */
  public async cleanupExpiredUnacceptedOrders(): Promise<{ deletedCount: number; deletedOrderIds: string[] }> {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const thresholdIso = new Date(now - ONE_HOUR_MS).toISOString();

    // 1. Identify ONLY orders where:
    //    - status === 'NEW' (strictly unaccepted by Admin)
    //    - createdAt is older than 1 hour (now - createdAt >= 1 hour)
    //    - Payment safety: unpaid (paymentStatus !== 'PAID' and paidAmount === 0 and paymentStatus !== 'VERIFYING')
    const expiredOrders = this.orders.filter(o => {
      if (o.status !== 'NEW') return false;
      if (!o.createdAt) return false;
      const createdTime = new Date(o.createdAt).getTime();
      if (isNaN(createdTime)) return false;
      if (now - createdTime < ONE_HOUR_MS) return false;

      // Payment safety: never auto-delete paid transactions or pending proof verifications
      const isPaid = o.paymentStatus === 'PAID' || (o.paidAmount && o.paidAmount > 0);
      const isVerifying = o.paymentStatus === 'VERIFYING';
      if (isPaid || isVerifying) return false;

      return true;
    });

    if (expiredOrders.length === 0) {
      return { deletedCount: 0, deletedOrderIds: [] };
    }

    const expiredOrderIds = expiredOrders.map(o => o.id);
    const expiredSet = new Set(expiredOrderIds);

    console.log(`[EXPIRED_CLEANUP] Found ${expiredOrderIds.length} unaccepted expired order(s) (>1h). Hard deleting...`, expiredOrderIds);

    // 2. Remove from local memory
    this.orders = this.orders.filter(o => !expiredSet.has(o.id));
    this.saveOrders();

    // 3. Clean up table session localStorage keys to avoid ghost references
    expiredOrders.forEach(ord => {
      try {
        const savedOrdersKey = `ana_session_orders_table_${ord.tableNumber}`;
        const savedOrdersStr = localStorage.getItem(savedOrdersKey);
        if (savedOrdersStr) {
          const arr = JSON.parse(savedOrdersStr);
          if (Array.isArray(arr)) {
            const filtered = arr.filter((id: string) => id !== ord.id);
            localStorage.setItem(savedOrdersKey, JSON.stringify(filtered));
          }
        }
        const activeKey = `ana_active_order_table_${ord.tableNumber}`;
        if (localStorage.getItem(activeKey) === ord.id) {
          localStorage.removeItem(activeKey);
        }
      } catch {
        // ignore
      }
    });

    // 4. Hard delete from Supabase with race condition protection
    if (isSupabaseConfigured && supabase) {
      try {
        // Condition: delete only if status is STILL 'NEW' and created_at <= threshold
        const { error: delErr } = await supabase
          .from('orders')
          .delete()
          .in('id', expiredOrderIds)
          .eq('status', 'NEW')
          .lte('created_at', thresholdIso);

        if (delErr) {
          console.warn('[EXPIRED_CLEANUP] Supabase error deleting expired orders:', delErr);
        } else {
          console.log(`[EXPIRED_CLEANUP] Supabase purged ${expiredOrderIds.length} expired unaccepted orders.`);
        }

        try {
          await supabase.from('order_payments').delete().in('order_id', expiredOrderIds);
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn('[EXPIRED_CLEANUP] Exception deleting expired orders from Supabase:', err);
      }
    }

    // 5. Broadcast to other tabs
    this.broadcastChannel?.postMessage({
      type: 'DELETE_ORDERS',
      payload: { orderIds: expiredOrderIds }
    });

    // 6. Notify listeners
    expiredOrders.forEach(ord => {
      this.notifyOrderListeners(ord, false);
      this.notifyTableListeners(ord);
    });

    return { deletedCount: expiredOrderIds.length, deletedOrderIds: expiredOrderIds };
  }

  public getSalesTransactions(): SalesTransaction[] {
    return [...this.salesTransactions].sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());
  }

  public getSalesTransactionItems(): SalesTransactionItem[] {
    return [...this.salesTransactionItems];
  }

  public subscribeToSales(listener: (transactions: SalesTransaction[]) => void): () => void {
    this.salesListeners.add(listener);
    listener(this.getSalesTransactions());
    return () => {
      this.salesListeners.delete(listener);
    };
  }

  private notifySalesListeners() {
    const sorted = this.getSalesTransactions();
    this.salesListeners.forEach(listener => {
      try {
        listener(sorted);
      } catch {
        // ignore
      }
    });
  }

  public async fetchSalesLedger(): Promise<{ transactions: SalesTransaction[]; items: SalesTransactionItem[] }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: txData, error: txErr } = await supabase
          .from('sales_transactions')
          .select('*')
          .order('confirmed_at', { ascending: false });

        const { data: itemData, error: itemErr } = await supabase
          .from('sales_transaction_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (!txErr && txData && Array.isArray(txData)) {
          this.salesTransactions = txData.map((raw: any) => ({
            id: String(raw.id),
            orderId: String(raw.order_id),
            orderNumber: String(raw.order_number),
            tableNumber: Number(raw.table_number),
            tableName: String(raw.table_name || `Bàn số ${raw.table_number}`),
            paymentId: raw.payment_id ? String(raw.payment_id) : undefined,
            paymentMethod: (raw.payment_method as PaymentMethod) || 'CASH',
            amount: Number(raw.amount || 0),
            totalItemsCount: Number(raw.total_items_count || 0),
            confirmedBy: raw.confirmed_by ? String(raw.confirmed_by) : undefined,
            confirmedAt: String(raw.confirmed_at || raw.created_at || new Date().toISOString()),
            createdAt: String(raw.created_at || new Date().toISOString())
          }));
        }

        if (!itemErr && itemData && Array.isArray(itemData)) {
          this.salesTransactionItems = itemData.map((raw: any) => ({
            id: String(raw.id),
            salesTransactionId: String(raw.sales_transaction_id),
            orderId: String(raw.order_id),
            orderItemId: String(raw.order_item_id),
            productId: String(raw.product_id),
            productName: String(raw.product_name),
            quantity: Number(raw.quantity || 1),
            unitPrice: Number(raw.unit_price || 0),
            totalPrice: Number(raw.total_price || 0),
            selectedSize: raw.selected_size ? String(raw.selected_size) : undefined,
            category: raw.category ? String(raw.category) : undefined,
            image: raw.image ? String(raw.image) : undefined,
            createdAt: String(raw.created_at || new Date().toISOString())
          }));
        }

        this.saveSalesLedger();
        this.notifySalesListeners();
      } catch (err) {
        console.warn('[SALES] Error fetching sales ledger:', err);
      }
    }
    return { transactions: this.salesTransactions, items: this.salesTransactionItems };
  }

  // --- CATEGORIES API ---
  public getCategories(): Category[] {
    return [...this.categories].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  public addCategory(cat: Omit<Category, 'id'>): Category {
    const newId = `cat-${Date.now()}`;
    const newCategory: Category = {
      ...cat,
      id: newId,
      displayOrder: cat.displayOrder || this.categories.length + 1,
      isActive: cat.isActive !== undefined ? cat.isActive : true
    };
    this.categories.push(newCategory);
    this.saveCategories();
    return newCategory;
  }

  public updateCategory(id: string, updates: Partial<Category>): Category | null {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.categories[idx] = { ...this.categories[idx], ...updates };
    this.saveCategories();
    return this.categories[idx];
  }

  public deleteCategory(id: string): { success: boolean; message?: string } {
    const hasProducts = this.products.some(p => p.category === id);
    if (hasProducts) {
      return { success: false, message: 'Danh mục này đang có sản phẩm, vui lòng chuyển hoặc xóa sản phẩm trước.' };
    }
    this.categories = this.categories.filter(c => c.id !== id);
    this.saveCategories();
    return { success: true };
  }

  // --- PRODUCTS API ---
  public getProducts(): Product[] {
    return [...this.products].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  public addProduct(prod: Omit<Product, 'id'>): Product {
    const newId = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...prod,
      id: newId,
      priceFormatted: `${prod.price}K`,
      rating: prod.rating || 5.0,
      reviewCount: prod.reviewCount || 0,
      isAvailable: prod.isAvailable !== undefined ? prod.isAvailable : true,
      displayOrder: prod.displayOrder || this.products.length + 1,
      createdAt: new Date().toISOString()
    };
    this.products.push(newProduct);
    this.saveProducts();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const existing = this.products[idx];
    const price = updates.price !== undefined ? updates.price : existing.price;
    const priceFormatted = updates.priceFormatted || `${price}K`;

    this.products[idx] = {
      ...existing,
      ...updates,
      price,
      priceFormatted,
      updatedAt: new Date().toISOString()
    };
    this.saveProducts();
    return this.products[idx];
  }

  public deleteProduct(id: string): boolean {
    const prod = this.products.find(p => p.id === id);
    if (prod && prod.image) {
      this.deleteProductImage(prod.image).catch(() => {});
    }
    this.products = this.products.filter(p => p.id !== id);
    this.saveProducts();
    return true;
  }

  public toggleProductAvailability(id: string): Product | null {
    const product = this.products.find(p => p.id === id);
    if (!product) return null;
    return this.updateProduct(id, { isAvailable: !product.isAvailable });
  }

  // --- PRODUCT IMAGE STORAGE API ---
  public async uploadProductImage(file: File): Promise<string> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      throw new Error('Ảnh không được lớn hơn 5MB');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase Storage chưa được cấu hình. Vui lòng kiểm tra file cấu hình .env.');
    }

    const rawExt = file.name.split('.').pop()?.toLowerCase() || '';
    const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt)
      ? rawExt
      : file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
      ? 'webp'
      : 'jpg';

    const filePath = `products/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        console.error('[STORAGE] Upload product image failed:', uploadErr);
        throw new Error(uploadErr.message || 'Không thể tải ảnh lên Supabase Storage. Vui lòng thử lại.');
      }

      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
      if (!publicUrlData?.publicUrl) {
        throw new Error('Không thể lấy Public URL từ Supabase Storage.');
      }

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.error('[STORAGE] Upload product image exception:', err);
      throw new Error(err.message || 'Có lỗi xảy ra khi tải ảnh lên máy chủ.');
    }
  }

  public async deleteProductImage(imageUrl: string): Promise<void> {
    if (!imageUrl || !isSupabaseConfigured || !supabase) return;

    // Do not delete local assets
    if (
      imageUrl.startsWith('/coffee_img/') ||
      imageUrl.startsWith('/trasua_img/') ||
      imageUrl.startsWith('/tra_img/') ||
      imageUrl.startsWith('/sinhto_img/') ||
      imageUrl.startsWith('/smoothie_img/') ||
      imageUrl.startsWith('/soda_img/') ||
      imageUrl.startsWith('/xoi_img/') ||
      imageUrl.startsWith('/images/') ||
      imageUrl.startsWith('/sounds/') ||
      imageUrl.startsWith('/videos/')
    ) {
      return;
    }

    // Only delete if it belongs to product-images bucket
    if (!imageUrl.includes('/product-images/')) {
      return;
    }

    try {
      const parts = imageUrl.split('/product-images/');
      if (parts.length < 2) return;
      const filePath = decodeURIComponent(parts[1].split('?')[0]);

      if (filePath) {
        const { error } = await supabase.storage.from('product-images').remove([filePath]);
        if (error) {
          console.warn('[STORAGE] Delete product image warning:', error);
        } else {
          console.log('[STORAGE] Deleted old product image from storage:', filePath);
        }
      }
    } catch (err) {
      console.warn('[STORAGE] Delete product image exception:', err);
    }
  }

  // --- ORDERS & REALTIME API ---
  public async fetchOrders(): Promise<OrderRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        console.log('[ORDERS] Fetching orders from Supabase...');
        const { data: dbOrders, error: ordersErr } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false });

        if (ordersErr) {
          console.warn('[ORDERS] Supabase fetch error:', ordersErr);
          return this.getOrders();
        }

        let dbPayments: any[] = [];
        try {
          const { data: payData } = await supabase.from('order_payments').select('*');
          if (payData && Array.isArray(payData)) {
            dbPayments = payData;
          }
        } catch {
          // ignore if table not created yet
        }

        if (dbOrders && Array.isArray(dbOrders)) {
          const mappedOrders: OrderRecord[] = dbOrders.map((raw: any) => {
            const rawItems = Array.isArray(raw.order_items) ? raw.order_items : [];
            const items = rawItems.map((it: any) => {
              let itemPayStatus: PaymentStatus = 'PENDING';
              if (it.payment_status) {
                itemPayStatus = it.payment_status as PaymentStatus;
              } else if (raw.payment_status === 'PAID') {
                itemPayStatus = 'PAID';
              } else if (raw.payment_status === 'VERIFYING') {
                itemPayStatus = 'VERIFYING';
              }

              return {
                id: String(it.id),
                orderId: String(it.order_id),
                productId: String(it.product_id),
                productName: String(it.product_name),
                unitPrice: Number(it.unit_price),
                quantity: Number(it.quantity),
                selectedSize: it.selected_size ? String(it.selected_size) : undefined,
                sugarLevel: it.sugar_level ? String(it.sugar_level) : undefined,
                iceLevel: it.ice_level ? String(it.ice_level) : undefined,
                toppings: Array.isArray(it.toppings) ? it.toppings : undefined,
                totalPrice: Number(it.total_price),
                image: it.image ? String(it.image) : undefined,
                paymentStatus: itemPayStatus,
                paymentId: it.payment_id ? String(it.payment_id) : undefined,
                revenueRecordedAt: it.revenue_recorded_at ? String(it.revenue_recorded_at) : undefined,
                salesTransactionId: it.sales_transaction_id ? String(it.sales_transaction_id) : undefined
              };
            });

            const rawPayments = dbPayments.filter((p: any) => String(p.order_id) === String(raw.id));
            let payments: OrderPaymentRecord[] = [];
            if (rawPayments.length > 0) {
              payments = rawPayments.map((p: any) => ({
                id: String(p.id),
                orderId: String(p.order_id),
                batchNumber: Number(p.batch_number || 1),
                amount: Number(p.amount || 0),
                paymentMethod: (p.payment_method as PaymentMethod) || 'CASH',
                paymentStatus: (p.payment_status as PaymentStatus) || 'PENDING',
                paymentProofPath: p.payment_proof_path ? String(p.payment_proof_path) : undefined,
                paymentSubmittedAt: p.payment_submitted_at ? String(p.payment_submitted_at) : undefined,
                paymentVerifiedAt: p.payment_verified_at ? String(p.payment_verified_at) : undefined,
                paymentVerifiedBy: p.payment_verified_by ? String(p.payment_verified_by) : undefined,
                paymentRejectionReason: p.payment_rejection_reason ? String(p.payment_rejection_reason) : undefined,
                note: p.note ? String(p.note) : undefined,
                createdAt: String(p.created_at || new Date().toISOString()),
                paidAt: p.paid_at ? String(p.paid_at) : undefined
              })).sort((a, b) => a.batchNumber - b.batchNumber);
            } else if (Number(raw.total || 0) > 0) {
              payments = [{
                id: `pay-${raw.id}-1`,
                orderId: String(raw.id),
                batchNumber: 1,
                amount: Number(raw.total || 0),
                paymentMethod: (raw.payment_method as PaymentMethod) || 'CASH',
                paymentStatus: (raw.payment_status as PaymentStatus) || (raw.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
                paymentProofPath: raw.payment_proof_path ? String(raw.payment_proof_path) : undefined,
                paymentSubmittedAt: raw.payment_submitted_at ? String(raw.payment_submitted_at) : undefined,
                paymentVerifiedAt: raw.payment_verified_at ? String(raw.payment_verified_at) : undefined,
                paymentVerifiedBy: raw.payment_verified_by ? String(raw.payment_verified_by) : undefined,
                paymentRejectionReason: raw.payment_rejection_reason ? String(raw.payment_rejection_reason) : undefined,
                createdAt: String(raw.created_at || new Date().toISOString()),
                paidAt: raw.payment_verified_at ? String(raw.payment_verified_at) : undefined
              }];
            }

            const paidAmount = payments.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + p.amount, 0);
            const remainingAmount = Math.max(0, Number(raw.total || 0) - paidAmount);

            return {
              id: String(raw.id),
              orderNumber: String(raw.order_number || `ANA-${Date.now().toString().slice(-4)}`),
              tableNumber: Number(raw.table_number || 1),
              tableName: String(raw.table_name || `Bàn số ${raw.table_number || 1}`),
              status: (raw.status as OrderStatus) || 'NEW',
              subtotal: Number(raw.subtotal || 0),
              discount: Number(raw.discount || 0),
              shippingFee: Number(raw.shipping_fee || 0),
              total: Number(raw.total || 0),
              paidAmount,
              remainingAmount,
              payments,
              note: raw.note ? String(raw.note) : undefined,
              voucherCode: raw.voucher_code ? String(raw.voucher_code) : undefined,
              items,
              paymentMethod: (raw.payment_method as PaymentMethod) || 'CASH',
              paymentStatus: (raw.payment_status as PaymentStatus) || (raw.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
              paymentProofPath: raw.payment_proof_path ? String(raw.payment_proof_path) : undefined,
              paymentSubmittedAt: raw.payment_submitted_at ? String(raw.payment_submitted_at) : undefined,
              paymentVerifiedAt: raw.payment_verified_at ? String(raw.payment_verified_at) : undefined,
              paymentVerifiedBy: raw.payment_verified_by ? String(raw.payment_verified_by) : undefined,
              paymentRejectionReason: raw.payment_rejection_reason ? String(raw.payment_rejection_reason) : undefined,
              createdAt: String(raw.created_at || new Date().toISOString()),
              updatedAt: raw.updated_at ? String(raw.updated_at) : (raw.created_at ? String(raw.created_at) : undefined),
              confirmedAt: raw.confirmed_at ? String(raw.confirmed_at) : undefined,
              preparingAt: raw.preparing_at ? String(raw.preparing_at) : undefined,
              readyAt: raw.ready_at ? String(raw.ready_at) : undefined,
              completedAt: raw.completed_at ? String(raw.completed_at) : undefined,
              cancelledAt: raw.cancelled_at ? String(raw.cancelled_at) : undefined
            };
          });

          this.orders = mappedOrders.sort(compareAdminOrders);
          // Synchronize orderSeq to max existing order number
          let maxSeq = 1000;
          mappedOrders.forEach((o) => {
            const m = o.orderNumber?.match(/ANA-(\d+)/);
            if (m) {
              const num = parseInt(m[1], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
          this.orderSeq = Math.max(this.orderSeq, maxSeq);
          this.saveOrders();
          await this.cleanupExpiredUnacceptedOrders();
          console.log('[ORDERS] Fetched result count:', this.orders.length, 'Next seq:', this.orderSeq);
          return this.orders;
        }
      } catch (err) {
        console.warn('[ORDERS] Error in fetchOrders:', err);
      }
    }

    await this.cleanupExpiredUnacceptedOrders();
    return this.getOrders();
  }

  public async fetchOrderById(orderId: string): Promise<OrderRecord | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .single();

        if (!error && data) {
          const rawItems = Array.isArray(data.order_items) ? data.order_items : [];
          const items: OrderRecord['items'] = rawItems.map((it: any) => {
            let itemPayStatus: PaymentStatus = 'PENDING';
            if (it.payment_status) {
              itemPayStatus = it.payment_status as PaymentStatus;
            } else if (data.payment_status === 'PAID') {
              itemPayStatus = 'PAID';
            } else if (data.payment_status === 'VERIFYING') {
              itemPayStatus = 'VERIFYING';
            }

            return {
              id: String(it.id),
              orderId: String(it.order_id),
              productId: String(it.product_id),
              productName: String(it.product_name),
              unitPrice: Number(it.unit_price),
              quantity: Number(it.quantity),
              selectedSize: it.selected_size ? String(it.selected_size) : undefined,
              sugarLevel: it.sugar_level ? String(it.sugar_level) : undefined,
              iceLevel: it.ice_level ? String(it.ice_level) : undefined,
              toppings: Array.isArray(it.toppings) ? it.toppings : undefined,
              totalPrice: Number(it.total_price),
              image: it.image ? String(it.image) : undefined,
              paymentStatus: itemPayStatus,
              paymentId: it.payment_id ? String(it.payment_id) : undefined,
              revenueRecordedAt: it.revenue_recorded_at ? String(it.revenue_recorded_at) : undefined,
              salesTransactionId: it.sales_transaction_id ? String(it.sales_transaction_id) : undefined
            };
          });

          let payments: OrderPaymentRecord[] = [];
          try {
            const { data: payData } = await supabase
              .from('order_payments')
              .select('*')
              .eq('order_id', orderId);
            if (payData && Array.isArray(payData) && payData.length > 0) {
              payments = payData.map((p: any) => ({
                id: String(p.id),
                orderId: String(p.order_id),
                batchNumber: Number(p.batch_number || 1),
                amount: Number(p.amount || 0),
                paymentMethod: (p.payment_method as PaymentMethod) || 'CASH',
                paymentStatus: (p.payment_status as PaymentStatus) || 'PENDING',
                paymentProofPath: p.payment_proof_path ? String(p.payment_proof_path) : undefined,
                paymentSubmittedAt: p.payment_submitted_at ? String(p.payment_submitted_at) : undefined,
                paymentVerifiedAt: p.payment_verified_at ? String(p.payment_verified_at) : undefined,
                paymentVerifiedBy: p.payment_verified_by ? String(p.payment_verified_by) : undefined,
                paymentRejectionReason: p.payment_rejection_reason ? String(p.payment_rejection_reason) : undefined,
                note: p.note ? String(p.note) : undefined,
                createdAt: String(p.created_at || new Date().toISOString()),
                paidAt: p.paid_at ? String(p.paid_at) : undefined
              })).sort((a, b) => a.batchNumber - b.batchNumber);
            }
          } catch {
            // ignore
          }

          if (payments.length === 0 && Number(data.total || 0) > 0) {
            payments = [{
              id: `pay-${data.id}-1`,
              orderId: String(data.id),
              batchNumber: 1,
              amount: Number(data.total || 0),
              paymentMethod: (data.payment_method as PaymentMethod) || 'CASH',
              paymentStatus: (data.payment_status as PaymentStatus) || (data.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
              paymentProofPath: data.payment_proof_path ? String(data.payment_proof_path) : undefined,
              paymentSubmittedAt: data.payment_submitted_at ? String(data.payment_submitted_at) : undefined,
              paymentVerifiedAt: data.payment_verified_at ? String(data.payment_verified_at) : undefined,
              paymentVerifiedBy: data.payment_verified_by ? String(data.payment_verified_by) : undefined,
              paymentRejectionReason: data.payment_rejection_reason ? String(data.payment_rejection_reason) : undefined,
              createdAt: String(data.created_at || new Date().toISOString()),
              paidAt: data.payment_verified_at ? String(data.payment_verified_at) : undefined
            }];
          }

          const paidAmount = payments.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + p.amount, 0);
          const remainingAmount = Math.max(0, Number(data.total || 0) - paidAmount);

          const freshOrder: OrderRecord = {
            id: String(data.id),
            orderNumber: String(data.order_number || `ANA-${Date.now().toString().slice(-4)}`),
            tableNumber: Number(data.table_number || 1),
            tableName: String(data.table_name || `Bàn số ${data.table_number || 1}`),
            status: (data.status as OrderStatus) || 'NEW',
            subtotal: Number(data.subtotal || 0),
            discount: Number(data.discount || 0),
            shippingFee: Number(data.shipping_fee || 0),
            total: Number(data.total || 0),
            paidAmount,
            remainingAmount,
            payments,
            note: data.note ? String(data.note) : undefined,
            voucherCode: data.voucher_code ? String(data.voucher_code) : undefined,
            items,
            paymentMethod: (data.payment_method as PaymentMethod) || 'CASH',
            paymentStatus: (data.payment_status as PaymentStatus) || (data.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
            paymentProofPath: data.payment_proof_path ? String(data.payment_proof_path) : undefined,
            paymentSubmittedAt: data.payment_submitted_at ? String(data.payment_submitted_at) : undefined,
            paymentVerifiedAt: data.payment_verified_at ? String(data.payment_verified_at) : undefined,
            paymentVerifiedBy: data.payment_verified_by ? String(data.payment_verified_by) : undefined,
            paymentRejectionReason: data.payment_rejection_reason ? String(data.payment_rejection_reason) : undefined,
            createdAt: String(data.created_at || new Date().toISOString()),
            updatedAt: data.updated_at ? String(data.updated_at) : (data.created_at ? String(data.created_at) : undefined),
            confirmedAt: data.confirmed_at ? String(data.confirmed_at) : undefined,
            preparingAt: data.preparing_at ? String(data.preparing_at) : undefined,
            readyAt: data.ready_at ? String(data.ready_at) : undefined,
            completedAt: data.completed_at ? String(data.completed_at) : undefined,
            cancelledAt: data.cancelled_at ? String(data.cancelled_at) : undefined
          };

          this.orders = [freshOrder, ...this.orders.filter(o => o.id !== orderId)];
          this.saveOrders();
          return freshOrder;
        }
      } catch (err) {
        console.warn('[ORDERS] Error fetching single order:', err);
      }
    }
    return this.orders.find(o => o.id === orderId) || null;
  }

  public getOrders(): OrderRecord[] {
    return [...this.orders].sort(compareAdminOrders);
  }

  public getTableActiveOrders(tableNumber: number): OrderRecord[] {
    return this.orders
      .filter(o => o.tableNumber === tableNumber && o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
      .sort(compareAdminOrders);
  }

  public getTableOpenOrder(tableNumber: number, orderSessionId?: string): OrderRecord | null {
    const found = this.orders
      .filter(o => {
        if (o.tableNumber !== tableNumber || o.status !== 'NEW') return false;
        if (orderSessionId && o.orderSessionId && o.orderSessionId !== orderSessionId) return false;
        // Lock open order if already PAID or if customer has submitted proof (VERIFYING)
        if (o.paymentStatus === 'PAID') return false;
        if (o.paymentMethod === 'BANK_TRANSFER' && o.paymentStatus === 'VERIFYING') return false;
        return true;
      })
      .sort(compareAdminOrders);
    return found[0] || null;
  }

  public async appendItemsToOpenOrder(
    orderId: string,
    newItems: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[],
    extra?: { note?: string; voucherCode?: string }
  ): Promise<{ success: boolean; order?: OrderRecord; wasConfirmed?: boolean; error?: string }> {
    console.log('[ORDER] Appending items to open order:', orderId, 'New items count:', newItems.length);
    const deltaSubtotal = newItems.reduce((sum, it) => sum + it.totalPrice, 0);
    return this.appendItemsToOrder({
      orderId,
      items: newItems,
      deltaSubtotal,
      deltaTotal: deltaSubtotal,
      paymentMethod: 'CASH',
      note: extra?.note,
      voucherCode: extra?.voucherCode
    });
  }

  public async appendItemsToOrder(
    params: AppendOrderParams
  ): Promise<{ success: boolean; order?: OrderRecord; wasConfirmed?: boolean; error?: string }> {
    const {
      orderId,
      items: newItems,
      deltaSubtotal,
      deltaDiscount = 0,
      deltaTotal,
      paymentMethod,
      paymentProofFile,
      note,
      voucherCode
    } = params;

    console.log('[ORDER] appendItemsToOrder started for order:', orderId, 'Delta items:', newItems.length, 'Delta subtotal:', deltaSubtotal, 'Delta total:', deltaTotal);

    let currentOrder: OrderRecord | null = null;
    let initialDbItemIds = new Set<string>();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbCheck, error: checkErr } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .single();

        if (checkErr || !dbCheck) {
          return { success: false, error: 'Không tìm thấy đơn hàng cần gọi thêm món.' };
        }

        if (dbCheck.status === 'CANCELLED' || dbCheck.status === 'COMPLETED') {
          return {
            success: false,
            wasConfirmed: true,
            error: 'Đơn hàng này đã kết thúc. Vui lòng tạo đơn mới.'
          };
        }

        const rawDbItems = Array.isArray(dbCheck.order_items) ? dbCheck.order_items : [];
        initialDbItemIds = new Set(rawDbItems.map((r: any) => String(r.id)));

        const existingDbItems = rawDbItems.map((it: any) => ({
          id: String(it.id),
          orderId: String(it.order_id),
          productId: String(it.product_id),
          productName: String(it.product_name),
          unitPrice: Number(it.unit_price),
          quantity: Number(it.quantity),
          selectedSize: it.selected_size ? String(it.selected_size) : undefined,
          sugarLevel: it.sugar_level ? String(it.sugar_level) : undefined,
          iceLevel: it.ice_level ? String(it.ice_level) : undefined,
          toppings: Array.isArray(it.toppings) ? it.toppings : undefined,
          totalPrice: Number(it.total_price),
          image: it.image ? String(it.image) : undefined
        }));

        const existingLocal = this.orders.find(o => o.id === orderId);
        const localItems = existingLocal?.items || [];
        const combinedExistingItems = [...existingDbItems];
        for (const loc of localItems) {
          if (!combinedExistingItems.some(it => it.id === loc.id)) {
            combinedExistingItems.push(loc);
          }
        }

        let payments: OrderPaymentRecord[] = [];
        try {
          const { data: payData } = await supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', orderId);
          if (payData && Array.isArray(payData) && payData.length > 0) {
            payments = payData.map((p: any) => ({
              id: String(p.id),
              orderId: String(p.order_id),
              batchNumber: Number(p.batch_number || 1),
              amount: Number(p.amount || 0),
              paymentMethod: (p.payment_method as PaymentMethod) || 'CASH',
              paymentStatus: (p.payment_status as PaymentStatus) || 'PENDING',
              paymentProofPath: p.payment_proof_path ? String(p.payment_proof_path) : undefined,
              paymentSubmittedAt: p.payment_submitted_at ? String(p.payment_submitted_at) : undefined,
              paymentVerifiedAt: p.payment_verified_at ? String(p.payment_verified_at) : undefined,
              paymentVerifiedBy: p.payment_verified_by ? String(p.payment_verified_by) : undefined,
              paymentRejectionReason: p.payment_rejection_reason ? String(p.payment_rejection_reason) : undefined,
              note: p.note ? String(p.note) : undefined,
              createdAt: String(p.created_at || new Date().toISOString()),
              paidAt: p.paid_at ? String(p.paid_at) : undefined
            })).sort((a, b) => a.batchNumber - b.batchNumber);
          }
        } catch {
          // ignore
        }

        if (payments.length === 0 && existingLocal?.payments && existingLocal.payments.length > 0) {
          payments = [...existingLocal.payments];
        }

        if (payments.length === 0 && Number(dbCheck.total || 0) > 0) {
          payments = [{
            id: `pay-${dbCheck.id}-1`,
            orderId: String(dbCheck.id),
            batchNumber: 1,
            amount: Number(dbCheck.total || 0),
            paymentMethod: (dbCheck.payment_method as PaymentMethod) || 'CASH',
            paymentStatus: (dbCheck.payment_status as PaymentStatus) || (dbCheck.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
            paymentProofPath: dbCheck.payment_proof_path ? String(dbCheck.payment_proof_path) : undefined,
            paymentSubmittedAt: dbCheck.payment_submitted_at ? String(dbCheck.payment_submitted_at) : undefined,
            paymentVerifiedAt: dbCheck.payment_verified_at ? String(dbCheck.payment_verified_at) : undefined,
            paymentVerifiedBy: dbCheck.payment_verified_by ? String(dbCheck.payment_verified_by) : undefined,
            createdAt: String(dbCheck.created_at || new Date().toISOString()),
            paidAt: dbCheck.payment_verified_at ? String(dbCheck.payment_verified_at) : undefined
          }];
        }

        currentOrder = {
          id: String(dbCheck.id),
          orderNumber: String(dbCheck.order_number),
          tableNumber: Number(dbCheck.table_number),
          tableName: String(dbCheck.table_name),
          status: (dbCheck.status as OrderStatus) || 'NEW',
          subtotal: Number(dbCheck.subtotal || 0),
          discount: Number(dbCheck.discount || 0),
          shippingFee: Number(dbCheck.shipping_fee || 0),
          total: Number(dbCheck.total || 0),
          paidAmount: getOrderPaidAmount({ ...dbCheck, payments }),
          remainingAmount: getOrderRemainingAmount({ ...dbCheck, payments }),
          payments,
          note: dbCheck.note ? String(dbCheck.note) : undefined,
          voucherCode: dbCheck.voucher_code ? String(dbCheck.voucher_code) : undefined,
          items: combinedExistingItems,
          paymentMethod: (dbCheck.payment_method as PaymentMethod) || 'CASH',
          paymentStatus: (dbCheck.payment_status as PaymentStatus) || 'PENDING',
          paymentProofPath: dbCheck.payment_proof_path ? String(dbCheck.payment_proof_path) : undefined,
          paymentSubmittedAt: dbCheck.payment_submitted_at ? String(dbCheck.payment_submitted_at) : undefined,
          paymentVerifiedAt: dbCheck.payment_verified_at ? String(dbCheck.payment_verified_at) : undefined,
          paymentVerifiedBy: dbCheck.payment_verified_by ? String(dbCheck.payment_verified_by) : undefined,
          createdAt: String(dbCheck.created_at),
          orderSessionId: existingLocal?.orderSessionId
        };
      } catch (err) {
        console.warn('[ORDER] Supabase check error in appendItemsToOrder:', err);
      }
    }

    if (!currentOrder) {
      const local = this.orders.find(o => o.id === orderId);
      if (!local) {
        return { success: false, error: 'Không tìm thấy đơn hàng cần gọi thêm món.' };
      }
      if (local.status === 'CANCELLED' || local.status === 'COMPLETED') {
        return { success: false, error: 'Đơn hàng này đã kết thúc. Vui lòng tạo đơn mới.' };
      }
      currentOrder = { ...local };
    }

    // Upload proof if Bank Transfer and file is provided
    let proofUrl: string | undefined = undefined;
    if (paymentMethod === 'BANK_TRANSFER' && paymentProofFile) {
      const ext = paymentProofFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${orderId}/proof-batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      if (isSupabaseConfigured && supabase) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, paymentProofFile, { cacheControl: '3600', upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
            proofUrl = publicUrlData?.publicUrl || filePath;
          } else {
            proofUrl = await this.fileToDataUrl(paymentProofFile);
          }
        } catch {
          proofUrl = await this.fileToDataUrl(paymentProofFile);
        }
      } else {
        proofUrl = await this.fileToDataUrl(paymentProofFile);
      }
    }

    // Merge new items into existing items
    const mergedItems: OrderRecord['items'] = [...currentOrder.items];

    for (const newItem of newItems) {
      const targetSize = newItem.selectedSize || 'M';
      const targetSugar = newItem.sugarLevel || '100%';
      const targetIce = newItem.iceLevel || '100%';
      const targetToppings = (newItem.toppings || []).slice().sort().join(',');

      const matchIndex = mergedItems.findIndex(it => {
        const itToppings = (it.toppings || []).slice().sort().join(',');
        return (
          it.productId === newItem.productId &&
          (it.selectedSize || 'M') === targetSize &&
          (it.sugarLevel || '100%') === targetSugar &&
          (it.iceLevel || '100%') === targetIce &&
          itToppings === targetToppings
        );
      });

      if (matchIndex > -1) {
        const existing = mergedItems[matchIndex];
        const newQty = existing.quantity + newItem.quantity;
        const unitPrice = existing.unitPrice || newItem.unitPrice;
        mergedItems[matchIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: newQty * unitPrice
        };
      } else {
        const newId = `item-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        mergedItems.push({
          ...newItem,
          id: newId,
          orderId
        });
      }
    }

    // Recalculate totals
    const newSubtotal = mergedItems.reduce((sum, it) => sum + it.totalPrice, 0);
    const shippingFee = 0;
    const totalDiscount = (currentOrder.discount || 0) + deltaDiscount;
    const newTotal = Math.max(0, newSubtotal - totalDiscount);
    const combinedNote = note
      ? currentOrder.note
        ? `${currentOrder.note}; ${note}`
        : note
      : currentOrder.note;

    // Manage Payments History
    const now = new Date().toISOString();
    const existingPayments: OrderPaymentRecord[] = currentOrder.payments && currentOrder.payments.length > 0
      ? [...currentOrder.payments]
      : (currentOrder.total > 0 ? [{
          id: `pay-${orderId}-1`,
          orderId,
          batchNumber: 1,
          amount: currentOrder.total,
          paymentMethod: currentOrder.paymentMethod,
          paymentStatus: currentOrder.paymentStatus,
          paymentProofPath: currentOrder.paymentProofPath,
          paymentSubmittedAt: currentOrder.paymentSubmittedAt,
          paymentVerifiedAt: currentOrder.paymentVerifiedAt,
          paymentVerifiedBy: currentOrder.paymentVerifiedBy,
          createdAt: currentOrder.createdAt,
          paidAt: currentOrder.paymentVerifiedAt
        }] : []);

    const newBatchNumber = existingPayments.length + 1;
    const newPaymentStatus: PaymentStatus =
      paymentMethod === 'BANK_TRANSFER' && proofUrl ? 'VERIFYING' : 'PENDING';

    const newPaymentRecord: OrderPaymentRecord = {
      id: `pay-${orderId}-${newBatchNumber}-${Date.now()}`,
      orderId,
      batchNumber: newBatchNumber,
      amount: deltaTotal,
      paymentMethod,
      paymentStatus: newPaymentStatus,
      paymentProofPath: proofUrl,
      paymentSubmittedAt: proofUrl ? now : undefined,
      createdAt: now,
      note: note ? `Gọi thêm món: ${note}` : `Gọi thêm lần ${newBatchNumber - 1}`
    };

    const updatedPayments = [...existingPayments, newPaymentRecord];
    const paidAmount = updatedPayments
      .filter(p => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, newTotal - paidAmount);

    let rootPaymentStatus: PaymentStatus = 'PENDING';
    if (remainingAmount === 0 && newTotal > 0) {
      rootPaymentStatus = 'PAID';
    } else if (updatedPayments.some(p => p.paymentStatus === 'VERIFYING')) {
      rootPaymentStatus = 'VERIFYING';
    } else if (updatedPayments.some(p => p.paymentStatus === 'REJECTED') && remainingAmount > 0) {
      rootPaymentStatus = 'REJECTED';
    } else {
      rootPaymentStatus = 'PENDING';
    }

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      subtotal: newSubtotal,
      discount: totalDiscount,
      shippingFee,
      total: newTotal,
      paidAmount,
      remainingAmount,
      payments: updatedPayments,
      note: combinedNote,
      voucherCode: voucherCode || currentOrder.voucherCode,
      items: mergedItems,
      paymentMethod,
      paymentStatus: rootPaymentStatus,
      paymentProofPath: proofUrl || currentOrder.paymentProofPath,
      paymentSubmittedAt: proofUrl ? now : currentOrder.paymentSubmittedAt,
      updatedAt: now
    };

    // Persist to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('orders')
          .update({
            subtotal: newSubtotal,
            discount: totalDiscount,
            shipping_fee: shippingFee,
            total: newTotal,
            note: combinedNote || null,
            voucher_code: updatedOrder.voucherCode || null,
            payment_method: paymentMethod,
            payment_status: rootPaymentStatus,
            payment_proof_path: updatedOrder.paymentProofPath || null,
            payment_submitted_at: updatedOrder.paymentSubmittedAt || null
          })
          .eq('id', orderId);

        const dbItems = mergedItems.map(it => ({
          id: it.id,
          order_id: orderId,
          product_id: it.productId,
          product_name: it.productName,
          unit_price: it.unitPrice,
          quantity: it.quantity,
          selected_size: it.selectedSize || null,
          sugar_level: it.sugarLevel || null,
          ice_level: it.iceLevel || null,
          toppings: it.toppings || [],
          total_price: it.totalPrice,
          image: it.image || null
        }));

        const newDbItems = dbItems.filter(it => !initialDbItemIds.has(it.id));
        const updatedExistingDbItems = dbItems.filter(it => initialDbItemIds.has(it.id));

        if (newDbItems.length > 0) {
          const { error: insertErr } = await supabase.from('order_items').insert(newDbItems);
          if (insertErr) {
            console.error('[ORDER] Error inserting new order items:', insertErr);
          }
        }

        for (const it of updatedExistingDbItems) {
          await supabase.from('order_items').update({
            quantity: it.quantity,
            total_price: it.total_price
          }).eq('id', it.id);
        }

        try {
          await supabase.from('order_payments').insert({
            id: newPaymentRecord.id,
            order_id: orderId,
            batch_number: newPaymentRecord.batchNumber,
            amount: newPaymentRecord.amount,
            payment_method: newPaymentRecord.paymentMethod,
            payment_status: newPaymentRecord.paymentStatus,
            payment_proof_path: newPaymentRecord.paymentProofPath || null,
            payment_submitted_at: newPaymentRecord.paymentSubmittedAt || null,
            note: newPaymentRecord.note || null,
            created_at: newPaymentRecord.createdAt
          });
        } catch (payErr) {
          console.warn('[ORDER] Note: order_payments table not yet created or insert skipped:', payErr);
        }
      } catch (err: any) {
        console.error('[ORDER] Supabase update in appendItemsToOrder failed:', err);
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Trigger Admin Realtime Notification
    const addedItemsSummary = newItems.map(it => ({
      name: it.productName,
      quantity: it.quantity
    }));
    adminNotificationService.notifyItemsAdded(updatedOrder, addedItemsSummary, deltaTotal);

    // Realtime broadcast
    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_CONTENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, order: updatedOrder };
  }

  public async createOrder(params: {
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
    orderSessionId?: string;
    items: Omit<OrderRecord['items'][0], 'id' | 'orderId'>[];
  }): Promise<OrderRecord> {
    console.log('[ORDER] Submit started for table:', params.tableNumber, 'Session:', params.orderSessionId);

    // 1. Calculate highest existing sequence across local memory
    let maxSeq = 1000;
    this.orders.forEach((o) => {
      const m = o.orderNumber?.match(/ANA-(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    this.orderSeq = Math.max(this.orderSeq, maxSeq);

    // 2. If Supabase is connected, query latest order number to ensure no conflict across clients
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: latestDbOrders } = await supabase
          .from('orders')
          .select('order_number')
          .order('created_at', { ascending: false })
          .limit(20);

        if (latestDbOrders && Array.isArray(latestDbOrders)) {
          latestDbOrders.forEach((rec: any) => {
            const m = rec.order_number?.match(/ANA-(\d+)/);
            if (m) {
              const num = parseInt(m[1], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
          this.orderSeq = Math.max(this.orderSeq, maxSeq);
        }
      } catch {
        // Continue with local sequence if network fails
      }
    }

    const createdAt = new Date().toISOString();
    const paymentMethod: PaymentMethod = params.paymentMethod || 'CASH';
    const paymentStatus: PaymentStatus =
      paymentMethod === 'BANK_TRANSFER' && params.paymentProofPath
        ? 'VERIFYING'
        : 'PENDING';

    let finalOrder: OrderRecord | null = null;

    // Retry loop on possible sequence collision (up to 3 attempts)
    for (let attempt = 0; attempt < 3; attempt++) {
      this.orderSeq += 1;
      const orderNumber = `ANA-${this.orderSeq}`;
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const orderItems = params.items.map((it, idx) => ({
        ...it,
        id: `item-${orderId}-${idx + 1}`,
        orderId
      }));

      const initialPayment: OrderPaymentRecord = {
        id: `pay-${orderId}-1`,
        orderId,
        batchNumber: 1,
        amount: params.total,
        paymentMethod,
        paymentStatus,
        paymentProofPath: params.paymentProofPath,
        paymentSubmittedAt: params.paymentSubmittedAt || (params.paymentProofPath ? createdAt : undefined),
        createdAt
      };

      const finalShippingFee = 0;
      const newOrder: OrderRecord = {
        id: orderId,
        orderNumber,
        tableNumber: params.tableNumber,
        tableName: params.tableName,
        status: 'NEW',
        subtotal: params.subtotal,
        discount: params.discount,
        shippingFee: finalShippingFee,
        total: params.total,
        paidAmount: (paymentStatus as PaymentStatus) === 'PAID' ? params.total : 0,
        remainingAmount: (paymentStatus as PaymentStatus) === 'PAID' ? 0 : params.total,
        payments: [initialPayment],
        note: params.note,
        voucherCode: params.voucherCode,
        items: orderItems,
        paymentMethod,
        paymentStatus,
        paymentProofPath: params.paymentProofPath,
        paymentSubmittedAt: params.paymentSubmittedAt || (params.paymentProofPath ? createdAt : undefined),
        createdAt,
        updatedAt: createdAt,
        orderSessionId: params.orderSessionId
      };

      console.log(`[ORDER] Attempt ${attempt + 1}: Payload ${orderNumber}, Items: ${newOrder.items.length}`);

      if (isSupabaseConfigured && supabase) {
        try {
          const { error: orderErr } = await supabase.from('orders').insert({
            id: orderId,
            order_number: orderNumber,
            table_number: params.tableNumber,
            table_name: params.tableName,
            status: 'NEW',
            subtotal: params.subtotal,
            discount: params.discount,
            shipping_fee: params.shippingFee,
            total: params.total,
            note: params.note,
            voucher_code: params.voucherCode,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            payment_proof_path: params.paymentProofPath || null,
            payment_submitted_at: newOrder.paymentSubmittedAt || null,
            created_at: createdAt
          });

          if (orderErr) {
            // Check for duplicate key / conflict
            if (orderErr.code === '23505' || orderErr.message?.includes('duplicate key') || (orderErr as any).status === 409) {
              console.warn(`[ORDER] Conflict on ${orderNumber}, retrying with next sequence...`);
              continue;
            }
            console.error('[ORDER] Supabase order insert failed:', orderErr);
            throw orderErr;
          }

          console.log('[ORDER] Order created in Supabase:', orderNumber);

          const dbItems = orderItems.map((it) => ({
            id: it.id,
            order_id: orderId,
            product_id: it.productId,
            product_name: it.productName,
            unit_price: it.unitPrice,
            quantity: it.quantity,
            selected_size: it.selectedSize,
            sugar_level: it.sugarLevel,
            ice_level: it.iceLevel,
            toppings: it.toppings,
            total_price: it.totalPrice,
            image: it.image
          }));

          const { error: itemsErr } = await supabase.from('order_items').insert(dbItems);
          if (itemsErr) {
            console.error('[ORDER] Supabase order items insert failed:', itemsErr);
            throw itemsErr;
          }

          console.log('[ORDER] Order items created in Supabase:', dbItems.length);

          try {
            await supabase.from('order_payments').insert({
              id: initialPayment.id,
              order_id: orderId,
              batch_number: initialPayment.batchNumber,
              amount: initialPayment.amount,
              payment_method: initialPayment.paymentMethod,
              payment_status: initialPayment.paymentStatus,
              payment_proof_path: initialPayment.paymentProofPath || null,
              payment_submitted_at: initialPayment.paymentSubmittedAt || null,
              created_at: initialPayment.createdAt
            });
          } catch (payErr) {
            console.warn('[ORDER] Note: order_payments insert skipped/fallback:', payErr);
          }
          finalOrder = newOrder;
          break;
        } catch (err: any) {
          if (attempt === 2) {
            console.error('[ORDER] All insert attempts failed on backend:', err);
            throw err;
          }
        }
      } else {
        finalOrder = newOrder;
        break;
      }
    }

    if (!finalOrder) {
      throw new Error('Không thể tạo đơn hàng sau nhiều lần thử.');
    }

    this.orders = [finalOrder, ...this.orders];
    this.saveOrders();

    // Check if this table previously had an order to determine if this is an additional order
    const prevOrder = this.orders
      .filter(o => o.id !== finalOrder!.id && o.tableNumber === finalOrder!.tableNumber && o.status !== 'CANCELLED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const isAdditional = Boolean(prevOrder);
    adminNotificationService.notifyOrderCreated(
      finalOrder,
      isAdditional,
      prevOrder?.orderNumber
    );

    // Broadcast realtime event across tabs/windows
    this.broadcastChannel?.postMessage({ type: 'NEW_ORDER', payload: finalOrder });
    this.notifyOrderListeners(finalOrder, true);
    this.notifyTableListeners(finalOrder);

    return finalOrder;
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderRecord | null> {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;

    const order = this.orders[idx];

    // Business rule: Order CANNOT be confirmed if payment_status !== 'PAID'
    if (status === 'CONFIRMED' && order.paymentStatus !== 'PAID') {
      console.warn('[ORDER] Cannot confirm order without payment verified.');
      return null;
    }

    const now = new Date().toISOString();

    const updates: Partial<OrderRecord> = { status };
    if (status === 'CONFIRMED') updates.confirmedAt = now;
    if (status === 'PREPARING') updates.preparingAt = now;
    if (status === 'READY') updates.readyAt = now;
    if (status === 'COMPLETED') updates.completedAt = now;
    if (status === 'CANCELLED') updates.cancelledAt = now;

    const updatedOrder: OrderRecord = { ...order, ...updates, updatedAt: now };
    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Ensure paid items are recorded into sales ledger when confirmed or completed
    if (status === 'CONFIRMED' || status === 'COMPLETED') {
      const unrecordedPaidItems = updatedOrder.items.filter(it => it.paymentStatus === 'PAID' && !it.revenueRecordedAt);
      if (unrecordedPaidItems.length > 0) {
        this.confirmSale({
          orderId,
          itemIds: unrecordedPaidItems.map(it => it.id),
          paymentMethod: updatedOrder.paymentMethod,
          verifiedBy: 'Admin'
        });
      }
    }

    // Broadcast realtime update across tabs/windows
    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_STATUS', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);
    if (status === 'COMPLETED') {
      this.notifyMonthlyStatsListeners();
    }

    // Async persist to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('orders').update({
          status,
          confirmed_at: updates.confirmedAt,
          preparing_at: updates.preparingAt,
          ready_at: updates.readyAt,
          completed_at: updates.completedAt,
          cancelled_at: updates.cancelledAt
        }).eq('id', orderId);
      } catch (err) {
        console.warn('[ORDER] Supabase status update error:', err);
      }
    }

    return updatedOrder;
  }

  // --- PAYMENT API ---
  public async uploadPaymentProof(
    orderId: string,
    file: File,
    paymentId?: string
  ): Promise<{ success: boolean; proofUrl?: string; error?: string }> {
    // 1. File validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return { success: false, error: 'Vui lòng chọn hình ảnh JPG, PNG hoặc WEBP hợp lệ.' };
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      return { success: false, error: 'Dung lượng ảnh không được vượt quá 5MB.' };
    }

    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${orderId}/proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    let proofUrl = '';

    // 2. Upload to Supabase Storage if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadErr) {
          console.warn('[STORAGE] Upload to bucket failed, using data URL fallback:', uploadErr);
          proofUrl = await this.fileToDataUrl(file);
        } else {
          const { data: publicUrlData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
          proofUrl = publicUrlData?.publicUrl || filePath;
        }
      } catch (err) {
        console.warn('[STORAGE] Upload exception:', err);
        proofUrl = await this.fileToDataUrl(file);
      }
    } else {
      proofUrl = await this.fileToDataUrl(file);
    }

    const now = new Date().toISOString();
    const currentOrder = this.orders[existingIndex];

    let payments = currentOrder.payments && currentOrder.payments.length > 0
      ? [...currentOrder.payments]
      : [{
          id: `pay-${orderId}-1`,
          orderId,
          batchNumber: 1,
          amount: currentOrder.total,
          paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
          paymentStatus: 'VERIFYING' as PaymentStatus,
          paymentProofPath: proofUrl,
          paymentSubmittedAt: now,
          createdAt: currentOrder.createdAt
        }];

    // Target specific payment or latest unpaid
    let targetPaymentId = paymentId;
    if (!targetPaymentId) {
      const unpaid = payments.filter(p => p.paymentStatus !== 'PAID');
      targetPaymentId = unpaid.length > 0 ? unpaid[unpaid.length - 1].id : payments[payments.length - 1]?.id;
    }

    payments = payments.map(p => {
      if (p.id === targetPaymentId) {
        return {
          ...p,
          paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
          paymentStatus: 'VERIFYING' as PaymentStatus,
          paymentProofPath: proofUrl,
          paymentSubmittedAt: now,
          paymentRejectionReason: undefined
        };
      }
      return p;
    });

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'VERIFYING',
      paymentProofPath: proofUrl,
      paymentSubmittedAt: now,
      paymentRejectionReason: undefined,
      payments,
      updatedAt: now
    };

    // 3. Persist to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        let rpcSuccess = false;
        if (targetPaymentId) {
          try {
            const { error: rpcErr } = await supabase.rpc('customer_submit_payment_proof', {
              p_order_id: orderId,
              p_payment_id: targetPaymentId,
              p_proof_url: proofUrl
            });
            if (!rpcErr) {
              rpcSuccess = true;
            }
          } catch {}
        }

        if (!rpcSuccess) {
          await supabase.from('orders').update({
            payment_method: 'BANK_TRANSFER',
            payment_status: 'VERIFYING',
            payment_proof_path: proofUrl,
            payment_submitted_at: now,
            payment_rejection_reason: null
          }).eq('id', orderId);

          if (targetPaymentId) {
            try {
              await supabase.from('order_payments').update({
                payment_method: 'BANK_TRANSFER',
                payment_status: 'VERIFYING',
                payment_proof_path: proofUrl,
                payment_submitted_at: now,
                payment_rejection_reason: null
              }).eq('id', targetPaymentId);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[ORDER] Supabase update payment proof error:', err);
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Trigger Admin Realtime Notification: PAYMENT_PROOF_SUBMITTED / RESUBMITTED
    adminNotificationService.notifyPaymentProofSubmitted(
      updatedOrder,
      currentOrder.paymentStatus === 'REJECTED'
    );

    // Broadcast realtime update across all tabs & Admin
    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_PAYMENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, proofUrl };
  }

  public async confirmSale(params: {
    orderId: string;
    itemIds?: string[];
    paymentId?: string;
    paymentMethod?: PaymentMethod;
    verifiedBy?: string;
  }): Promise<{ success: boolean; transactionId?: string; recordedAmount?: number; recordedItemsCount?: number; error?: string }> {
    const { orderId, itemIds, paymentId, paymentMethod = 'CASH', verifiedBy = 'Admin' } = params;

    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];
    if (currentOrder.status === 'CANCELLED') {
      return { success: false, error: 'Đơn hàng đã bị hủy, không thể ghi nhận doanh thu.' };
    }

    // 1. Identify candidate items
    const candidateItems = itemIds && itemIds.length > 0
      ? currentOrder.items.filter(it => itemIds.includes(it.id))
      : currentOrder.items;

    // Filter strictly unrecorded items: check item.revenueRecordedAt and this.salesTransactionItems
    const recordedItemIds = new Set(this.salesTransactionItems.map(si => si.orderItemId));
    const eligibleItems = candidateItems.filter(it => !it.revenueRecordedAt && !recordedItemIds.has(it.id));

    // IDEMPOTENCY: If no unrecorded items, return success with 0 new amount
    if (eligibleItems.length === 0) {
      console.log('[SALES] Idempotent check: all items already recorded for order:', orderId);
      return { success: true, recordedAmount: 0, recordedItemsCount: 0 };
    }

    const now = new Date().toISOString();
    const newTxId = `tx-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Calculate server-authoritative snapshot amounts
    const recordedAmount = eligibleItems.reduce((sum, it) => sum + Number(it.totalPrice || (it.unitPrice * it.quantity)), 0);
    const recordedItemsCount = eligibleItems.reduce((sum, it) => sum + Number(it.quantity || 1), 0);

    // 2. Supabase Atomic Confirmation (RPC or Fallback)
    let supabaseSuccess = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_confirm_sale', {
          p_order_id: orderId,
          p_item_ids: eligibleItems.map(it => it.id),
          p_payment_id: paymentId || null,
          p_payment_method: paymentMethod,
          p_confirmed_by: verifiedBy
        });

        if (!rpcErr && (rpcData as any)?.success) {
          supabaseSuccess = true;
          console.log('[SALES] RPC admin_confirm_sale succeeded:', rpcData);
        }
      } catch (rpcEx) {
        console.warn('[SALES] RPC admin_confirm_sale call exception, attempting fallback:', rpcEx);
      }

      if (!supabaseSuccess) {
        // Fallback direct table inserts if RPC not yet created
        try {
          await supabase.from('sales_transactions').insert({
            id: newTxId,
            order_id: orderId,
            order_number: currentOrder.orderNumber,
            table_number: currentOrder.tableNumber,
            table_name: currentOrder.tableName,
            payment_id: paymentId || null,
            payment_method: paymentMethod,
            amount: recordedAmount,
            total_items_count: recordedItemsCount,
            confirmed_by: verifiedBy,
            confirmed_at: now,
            created_at: now
          });

          const salesItemsRows = eligibleItems.map(it => ({
            id: `sitem-${newTxId}-${it.id}`,
            sales_transaction_id: newTxId,
            order_id: orderId,
            order_item_id: it.id,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            total_price: it.totalPrice || (it.unitPrice * it.quantity),
            selected_size: it.selectedSize || null,
            category: null,
            image: it.image || null,
            created_at: now
          }));

          await supabase.from('sales_transaction_items').insert(salesItemsRows);

          // Update order_items with revenue_recorded_at
          for (const it of eligibleItems) {
            try {
              await supabase.from('order_items').update({
                payment_status: 'PAID',
                revenue_recorded_at: now,
                sales_transaction_id: newTxId
              }).eq('id', it.id);
            } catch {}
          }
        } catch (fallbackErr) {
          console.warn('[SALES] Supabase direct fallback insert error:', fallbackErr);
        }
      }
    }

    // 3. Update local in-memory ledger and state
    const newTransaction: SalesTransaction = {
      id: newTxId,
      orderId,
      orderNumber: currentOrder.orderNumber,
      tableNumber: currentOrder.tableNumber,
      tableName: currentOrder.tableName,
      paymentId,
      paymentMethod,
      amount: recordedAmount,
      totalItemsCount: recordedItemsCount,
      confirmedBy: verifiedBy,
      confirmedAt: now,
      createdAt: now
    };

    const newTransactionItems: SalesTransactionItem[] = eligibleItems.map(it => ({
      id: `sitem-${newTxId}-${it.id}`,
      salesTransactionId: newTxId,
      orderId,
      orderItemId: it.id,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice || (it.unitPrice * it.quantity),
      selectedSize: it.selectedSize,
      image: it.image,
      createdAt: now
    }));

    this.salesTransactions = [newTransaction, ...this.salesTransactions];
    this.salesTransactionItems = [...newTransactionItems, ...this.salesTransactionItems];
    this.saveSalesLedger();

    // 4. Update items in local order record
    const eligibleIdsSet = new Set(eligibleItems.map(it => it.id));
    const updatedItems = currentOrder.items.map(it => {
      if (eligibleIdsSet.has(it.id)) {
        return {
          ...it,
          paymentStatus: 'PAID' as PaymentStatus,
          revenueRecordedAt: now,
          salesTransactionId: newTxId
        };
      }
      return it;
    });

    const updatedOrder = {
      ...currentOrder,
      items: updatedItems,
      updatedAt: now
    };
    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    this.notifySalesListeners();
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return {
      success: true,
      transactionId: newTxId,
      recordedAmount,
      recordedItemsCount
    };
  }

  public async verifyPayment(
    orderId: string,
    paymentId?: string,
    verifiedBy = 'Admin'
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];
    const now = new Date().toISOString();

    let payments = currentOrder.payments && currentOrder.payments.length > 0
      ? [...currentOrder.payments]
      : [{
          id: `pay-${orderId}-1`,
          orderId,
          batchNumber: 1,
          amount: currentOrder.total,
          paymentMethod: currentOrder.paymentMethod,
          paymentStatus: currentOrder.paymentStatus,
          paymentProofPath: currentOrder.paymentProofPath,
          paymentSubmittedAt: currentOrder.paymentSubmittedAt,
          createdAt: currentOrder.createdAt
        }];

    if (paymentId) {
      payments = payments.map(p => {
        if (p.id === paymentId) {
          return {
            ...p,
            paymentStatus: 'PAID' as PaymentStatus,
            paymentVerifiedAt: now,
            paymentVerifiedBy: verifiedBy,
            paymentRejectionReason: undefined,
            paidAt: now
          };
        }
        return p;
      });
    } else {
      payments = payments.map(p => {
        if (p.paymentStatus !== 'PAID') {
          return {
            ...p,
            paymentStatus: 'PAID' as PaymentStatus,
            paymentVerifiedAt: now,
            paymentVerifiedBy: verifiedBy,
            paymentRejectionReason: undefined,
            paidAt: now
          };
        }
        return p;
      });
    }

    const paidAmount = payments.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, currentOrder.total - paidAmount);
    const rootPaymentStatus: PaymentStatus = remainingAmount === 0 ? 'PAID' : (payments.some(p => p.paymentStatus === 'VERIFYING') ? 'VERIFYING' : 'PENDING');

    const updatedItems = currentOrder.items.map(it => {
      if (paymentId) {
        if (it.paymentId === paymentId || rootPaymentStatus === 'PAID') {
          return { ...it, paymentStatus: 'PAID' as PaymentStatus };
        }
      } else if (rootPaymentStatus === 'PAID') {
        return { ...it, paymentStatus: 'PAID' as PaymentStatus };
      }
      return it;
    });

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      items: updatedItems,
      paidAmount,
      remainingAmount,
      payments,
      paymentStatus: rootPaymentStatus,
      paymentVerifiedAt: now,
      paymentVerifiedBy: verifiedBy,
      paymentRejectionReason: undefined,
      updatedAt: now
    };

    if (isSupabaseConfigured && supabase) {
      try {
        let rpcSuccess = false;
        try {
          const { error: rpcErr } = await supabase.rpc('admin_verify_payment', {
            p_order_id: orderId,
            p_payment_id: paymentId || null,
            p_verified_by: verifiedBy
          });
          if (!rpcErr) {
            rpcSuccess = true;
          }
        } catch {}

        if (!rpcSuccess) {
          await supabase.from('orders').update({
            payment_status: rootPaymentStatus,
            payment_verified_at: now,
            payment_verified_by: verifiedBy,
            payment_rejection_reason: null
          }).eq('id', orderId);

          if (paymentId) {
            try {
              await supabase.from('order_payments').update({
                payment_status: 'PAID',
                payment_verified_at: now,
                payment_verified_by: verifiedBy,
                payment_rejection_reason: null,
                paid_at: now
              }).eq('id', paymentId);

              // Update order_items linked to this payment
              await supabase.from('order_items').update({
                payment_status: 'PAID'
              }).eq('order_id', orderId).eq('payment_id', paymentId);
            } catch {}
          } else {
            try {
              await supabase.from('order_payments').update({
                payment_status: 'PAID',
                payment_verified_at: now,
                payment_verified_by: verifiedBy,
                payment_rejection_reason: null,
                paid_at: now
              }).eq('order_id', orderId);

              await supabase.from('order_items').update({
                payment_status: 'PAID'
              }).eq('order_id', orderId);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[ORDER] Supabase verify payment error:', err);
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Record sales in immutable ledger for paid items
    const itemsToRecord = paymentId
      ? updatedOrder.items.filter(it => it.paymentId === paymentId || (rootPaymentStatus === 'PAID' && !it.revenueRecordedAt))
      : updatedOrder.items.filter(it => !it.revenueRecordedAt);

    if (itemsToRecord.length > 0) {
      await this.confirmSale({
        orderId,
        itemIds: itemsToRecord.map(it => it.id),
        paymentId,
        paymentMethod: currentOrder.paymentMethod,
        verifiedBy
      });
    }

    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_PAYMENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, order: updatedOrder };
  }

  public async adminPaySelectedItems(
    orderId: string,
    itemIds: string[],
    paymentMethod: PaymentMethod = 'CASH',
    verifiedBy = 'Admin'
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];
    if (currentOrder.status === 'CANCELLED') {
      return { success: false, error: 'Đơn hàng đã bị hủy, không thể thanh toán.' };
    }

    if (!itemIds || itemIds.length === 0) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 món để thanh toán.' };
    }

    // Filter eligible unpaid items
    const selectedItemSet = new Set(itemIds);
    const eligibleItems = currentOrder.items.filter(
      it => selectedItemSet.has(it.id) && it.paymentStatus !== 'PAID'
    );

    if (eligibleItems.length === 0) {
      return { success: false, error: 'Các món đã chọn đều đã được thanh toán trước đó.' };
    }

    const calculatedAmount = eligibleItems.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0);
    const now = new Date().toISOString();

    // Determine next batch number
    const existingPayments = currentOrder.payments || [];
    const maxBatch = existingPayments.reduce((max, p) => Math.max(max, p.batchNumber || 1), 0);
    const nextBatch = maxBatch + 1;
    const newPaymentId = `pay-${orderId}-${nextBatch}`;

    const newPaymentRecord: OrderPaymentRecord = {
      id: newPaymentId,
      orderId,
      batchNumber: nextBatch,
      amount: calculatedAmount,
      paymentMethod,
      paymentStatus: 'PAID',
      paymentVerifiedAt: now,
      paymentVerifiedBy: verifiedBy,
      paidAt: now,
      note: `Thanh toán ${eligibleItems.length} món (${eligibleItems.map(it => it.productName).join(', ')})`,
      createdAt: now,
      itemIds: eligibleItems.map(it => it.id)
    };

    const eligibleItemIdsSet = new Set(eligibleItems.map(it => it.id));
    const updatedItems = currentOrder.items.map(it => {
      if (eligibleItemIdsSet.has(it.id)) {
        return {
          ...it,
          paymentStatus: 'PAID' as PaymentStatus,
          paymentId: newPaymentId
        };
      }
      return it;
    });

    const updatedPayments = [...existingPayments, newPaymentRecord];
    const newPaidAmount = updatedPayments.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const newRemainingAmount = Math.max(0, currentOrder.total - newPaidAmount);
    const newOrderPaymentStatus: PaymentStatus = newRemainingAmount === 0 ? 'PAID' : (updatedPayments.some(p => p.paymentStatus === 'VERIFYING') ? 'VERIFYING' : 'PENDING');

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      items: updatedItems,
      payments: updatedPayments,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newOrderPaymentStatus,
      paymentVerifiedAt: now,
      paymentVerifiedBy: verifiedBy,
      updatedAt: now
    };

    // Supabase RPC or Direct update
    if (isSupabaseConfigured && supabase) {
      try {
        let rpcSuccess = false;
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_pay_selected_items', {
            p_order_id: orderId,
            p_item_ids: eligibleItems.map(it => it.id),
            p_payment_method: paymentMethod,
            p_verified_by: verifiedBy
          });
          if (!rpcErr && (rpcData as any)?.success) {
            rpcSuccess = true;
          }
        } catch {}

        if (!rpcSuccess) {
          // Fallback direct table updates
          await supabase.from('orders').update({
            payment_status: newOrderPaymentStatus,
            payment_verified_at: now,
            payment_verified_by: verifiedBy
          }).eq('id', orderId);

          await supabase.from('order_payments').insert({
            id: newPaymentRecord.id,
            order_id: orderId,
            batch_number: newPaymentRecord.batchNumber,
            amount: newPaymentRecord.amount,
            payment_method: newPaymentRecord.paymentMethod,
            payment_status: 'PAID',
            paid_at: now,
            payment_verified_at: now,
            payment_verified_by: verifiedBy,
            note: newPaymentRecord.note,
            created_at: now
          });

          for (const it of eligibleItems) {
            await supabase.from('order_items').update({
              payment_status: 'PAID',
              payment_id: newPaymentId
            }).eq('id', it.id);

            try {
              await supabase.from('order_payment_items').insert({
                id: `pi_${newPaymentId}_${it.id}`,
                payment_id: newPaymentId,
                order_item_id: it.id,
                order_id: orderId,
                amount: it.totalPrice,
                created_at: now
              });
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[ORDER] Supabase update in adminPaySelectedItems failed:', err);
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Record sales in immutable ledger for the paid items
    await this.confirmSale({
      orderId,
      itemIds: eligibleItems.map(it => it.id),
      paymentId: newPaymentId,
      paymentMethod,
      verifiedBy
    });

    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_PAYMENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, order: updatedOrder };
  }

  public async adminPayAllRemainingItems(
    orderId: string,
    paymentMethod: PaymentMethod = 'CASH',
    verifiedBy = 'Admin'
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const unpaidItems = order.items.filter(it => it.paymentStatus !== 'PAID');
    if (unpaidItems.length === 0) {
      return { success: false, error: 'Đơn hàng đã được thanh toán đầy đủ tất cả các món.' };
    }

    return this.adminPaySelectedItems(
      orderId,
      unpaidItems.map(it => it.id),
      paymentMethod,
      verifiedBy
    );
  }

  public async rejectPayment(
    orderId: string,
    paymentId?: string,
    reason = 'Hình ảnh thanh toán không hợp lệ'
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];
    let payments = currentOrder.payments && currentOrder.payments.length > 0
      ? [...currentOrder.payments]
      : [{
          id: `pay-${orderId}-1`,
          orderId,
          batchNumber: 1,
          amount: currentOrder.total,
          paymentMethod: currentOrder.paymentMethod,
          paymentStatus: currentOrder.paymentStatus,
          paymentProofPath: currentOrder.paymentProofPath,
          paymentSubmittedAt: currentOrder.paymentSubmittedAt,
          createdAt: currentOrder.createdAt
        }];

    if (paymentId) {
      payments = payments.map(p => {
        if (p.id === paymentId) {
          return {
            ...p,
            paymentStatus: 'REJECTED' as PaymentStatus,
            paymentRejectionReason: reason
          };
        }
        return p;
      });
    } else {
      payments = payments.map(p => {
        if (p.paymentStatus === 'VERIFYING') {
          return {
            ...p,
            paymentStatus: 'REJECTED' as PaymentStatus,
            paymentRejectionReason: reason
          };
        }
        return p;
      });
    }

    const now = new Date().toISOString();
    const paidAmount = payments.filter(p => p.paymentStatus === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, currentOrder.total - paidAmount);
    const rootPaymentStatus: PaymentStatus = payments.some(p => p.paymentStatus === 'REJECTED') && remainingAmount > 0
      ? 'REJECTED'
      : (remainingAmount === 0 ? 'PAID' : (payments.some(p => p.paymentStatus === 'VERIFYING') ? 'VERIFYING' : 'PENDING'));

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      paidAmount,
      remainingAmount,
      payments,
      paymentStatus: rootPaymentStatus,
      paymentRejectionReason: reason,
      updatedAt: now
    };

    if (isSupabaseConfigured && supabase) {
      try {
        let rpcSuccess = false;
        try {
          const { error: rpcErr } = await supabase.rpc('admin_reject_payment', {
            p_order_id: orderId,
            p_payment_id: paymentId || null,
            p_reason: reason
          });
          if (!rpcErr) {
            rpcSuccess = true;
          }
        } catch {}

        if (!rpcSuccess) {
          await supabase.from('orders').update({
            payment_status: rootPaymentStatus,
            payment_rejection_reason: reason
          }).eq('id', orderId);

          if (paymentId) {
            try {
              await supabase.from('order_payments').update({
                payment_status: 'REJECTED',
                payment_rejection_reason: reason
              }).eq('id', paymentId);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[ORDER] Supabase reject payment error:', err);
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_PAYMENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, order: updatedOrder };
  }

  public fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  public async updateCustomerOrder(
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
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];

    // Backend enforce: status must strictly be NEW
    if (currentOrder.status !== 'NEW') {
      return {
        success: false,
        error: 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
      };
    }

    const orderItems = params.items.map((it, idx) => ({
      ...it,
      id: `item-${orderId}-${Date.now()}-${idx + 1}`,
      orderId
    }));

    const updatedOrder: OrderRecord = {
      ...currentOrder,
      subtotal: params.subtotal,
      discount: params.discount,
      shippingFee: params.shippingFee,
      total: params.total,
      note: params.note,
      voucherCode: params.voucherCode,
      items: orderItems,
      updatedAt: new Date().toISOString()
    };

    // If Supabase is configured, enforce atomic status check and update in PostgreSQL
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Verify directly from DB that status is still strictly 'NEW'
        const { data: dbCheck, error: checkErr } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single();

        if (checkErr || !dbCheck || dbCheck.status !== 'NEW') {
          // Status was locked/changed by Admin! Refetch latest orders and reject
          await this.fetchOrders();
          return {
            success: false,
            error: 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
          };
        }

        // 2. Atomic update with WHERE status = 'NEW'
        const { data: updateRes, error: updateErr } = await supabase
          .from('orders')
          .update({
            subtotal: params.subtotal,
            discount: params.discount,
            shipping_fee: params.shippingFee,
            total: params.total,
            note: params.note || null,
            voucher_code: params.voucherCode || null
          })
          .eq('id', orderId)
          .eq('status', 'NEW')
          .select();

        if (updateErr || !updateRes || updateRes.length === 0) {
          await this.fetchOrders();
          return {
            success: false,
            error: 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
          };
        }

        // 3. Upsert updated items and clean up removed item IDs
        const dbItems = orderItems.map(it => ({
          id: it.id,
          order_id: orderId,
          product_id: it.productId,
          product_name: it.productName,
          unit_price: it.unitPrice,
          quantity: it.quantity,
          selected_size: it.selectedSize || null,
          sugar_level: it.sugarLevel || null,
          ice_level: it.iceLevel || null,
          toppings: it.toppings || [],
          total_price: it.totalPrice,
          image: it.image || null
        }));

        const { error: upsertErr } = await supabase.from('order_items').upsert(dbItems, { onConflict: 'id' });
        if (upsertErr) {
          console.error('[ORDER] Update order items upsert failed:', upsertErr);
        }

        const keepIds = orderItems.map(i => i.id);
        const { data: currentDbItems } = await supabase.from('order_items').select('id').eq('order_id', orderId);
        if (currentDbItems && Array.isArray(currentDbItems)) {
          const idsToDelete = currentDbItems.map((r: any) => String(r.id)).filter(id => !keepIds.includes(id));
          if (idsToDelete.length > 0) {
            await supabase.from('order_items').delete().in('id', idsToDelete);
          }
        }
      } catch (err: any) {
        console.error('[ORDER] Update customer order exception:', err);
        return {
          success: false,
          error: err?.message || 'Có lỗi xảy ra khi cập nhật đơn hàng.'
        };
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Trigger Admin Realtime Notification: ITEM_REMOVED or ORDER_UPDATED
    const prevNames = currentOrder.items.map(it => it.productName);
    const currNames = new Set(updatedOrder.items.map(it => it.productName));
    const removedNames = prevNames.filter(n => !currNames.has(n));

    if (removedNames.length > 0) {
      adminNotificationService.notifyItemRemoved(updatedOrder, removedNames, updatedOrder.total);
    } else {
      const changeDescriptions: string[] = [];
      for (const currItem of updatedOrder.items) {
        const prevItem = currentOrder.items.find(
          it => it.productId === currItem.productId || it.productName === currItem.productName
        );
        if (prevItem) {
          if (prevItem.quantity !== currItem.quantity) {
            changeDescriptions.push(`${currItem.productName}: ×${prevItem.quantity} → ×${currItem.quantity}`);
          } else {
            const optChanges: string[] = [];
            if (prevItem.selectedSize !== currItem.selectedSize && currItem.selectedSize) {
              optChanges.push(`Size ${currItem.selectedSize}`);
            }
            if (prevItem.sugarLevel !== currItem.sugarLevel && currItem.sugarLevel) {
              optChanges.push(`Đường ${currItem.sugarLevel}`);
            }
            if (prevItem.iceLevel !== currItem.iceLevel && currItem.iceLevel) {
              optChanges.push(`Đá ${currItem.iceLevel}`);
            }
            if (optChanges.length > 0) {
              changeDescriptions.push(`${currItem.productName} (${optChanges.join(', ')})`);
            }
          }
        }
      }

      if (currentOrder.note !== updatedOrder.note && updatedOrder.note) {
        changeDescriptions.push(`Ghi chú: "${updatedOrder.note}"`);
      }

      const diffSummary = changeDescriptions.length > 0
        ? changeDescriptions.join(', ')
        : 'Khách vừa cập nhật món và số lượng.';

      adminNotificationService.notifyOrderUpdated(updatedOrder, diffSummary);
    }

    // Broadcast across tabs/windows
    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_CONTENT', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true, order: updatedOrder };
  }

  public async cancelCustomerOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    const existingIndex = this.orders.findIndex(o => o.id === orderId);
    if (existingIndex === -1) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    const currentOrder = this.orders[existingIndex];
    if (currentOrder.status !== 'NEW') {
      return {
        success: false,
        error: 'Đơn hàng đã được quán xác nhận nên không thể hủy.'
      };
    }

    const now = new Date().toISOString();
    const updatedOrder: OrderRecord = {
      ...currentOrder,
      status: 'CANCELLED',
      cancelledAt: now,
      updatedAt: now
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .update({
            status: 'CANCELLED',
            cancelled_at: now
          })
          .eq('id', orderId)
          .eq('status', 'NEW')
          .select();

        if (error || !data || data.length === 0) {
          await this.fetchOrders();
          return {
            success: false,
            error: 'Đơn hàng đã được quán xác nhận nên không thể hủy.'
          };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Có lỗi khi hủy đơn.' };
      }
    }

    this.orders = [updatedOrder, ...this.orders.filter(o => o.id !== orderId)];
    this.saveOrders();

    // Trigger Admin Realtime Notification: ORDER_CANCELLED
    adminNotificationService.notifyOrderCancelled(updatedOrder);

    this.broadcastChannel?.postMessage({ type: 'UPDATE_ORDER_STATUS', payload: updatedOrder });
    this.notifyOrderListeners(updatedOrder, false);
    this.notifyTableListeners(updatedOrder);

    return { success: true };
  }

  // --- LISTENERS ---
  public subscribeToOrders(listener: OrderListener): () => void {
    this.orderListeners.add(listener);
    return () => {
      this.orderListeners.delete(listener);
    };
  }

  public subscribeToTable(tableNumber: number, listener: TableStatusListener): () => void {
    if (!this.tableListeners.has(tableNumber)) {
      this.tableListeners.set(tableNumber, new Set());
    }
    this.tableListeners.get(tableNumber)!.add(listener);

    return () => {
      this.tableListeners.get(tableNumber)?.delete(listener);
    };
  }

  private notifyOrderListeners(order: OrderRecord, isNew: boolean) {
    this.orderListeners.forEach(listener => {
      try {
        listener(order, isNew);
      } catch {
        // ignore
      }
    });
  }

  private notifyTableListeners(order: OrderRecord) {
    const tableSet = this.tableListeners.get(order.tableNumber);
    if (tableSet) {
      tableSet.forEach(listener => {
        try {
          listener(order);
        } catch {
          // ignore
        }
      });
    }
  }

  // --- REVENUE & KPI CALCULATIONS FROM IMMUTABLE SALES LEDGER & MONTHLY SNAPSHOTS ---
  public getRevenueStats(selectedYear?: number, selectedMonth?: number) {
    const now = new Date();
    const todayVietnamDateStr = getVietnamDateStr(now); // "YYYY-MM-DD"
    const currentVietnamMonthStr = getVietnamCurrentMonth(); // "YYYY-MM"
    const currentYear = selectedYear || (parseInt(currentVietnamMonthStr.slice(0, 4), 10) || now.getFullYear());
    const currentMonthNum = parseInt(currentVietnamMonthStr.slice(5, 7), 10) || (now.getMonth() + 1);

    const hasLedger = this.salesTransactions.length > 0;

    let todayRevenue = 0;
    let monthRevenue = 0;
    let yearRevenue = 0;
    let totalCompletedOrders = 0;
    let completedTodayCount = 0;
    let totalItemsSoldToday = 0;
    let totalItemsSoldYear = 0;

    const last7Days: RevenueDayReport[] = [];
    const monthlyBreakdown: { month: number; label: string; total: number; orderCount: number }[] = [];
    let topProducts: TopProductSales[] = [];

    // Filter live completed orders with completedAt in Vietnam timezone
    const liveCompletedOrders = this.orders.filter(o => o.status === 'COMPLETED' && o.completedAt);

    // 1. Today Stats (Vietnam timezone)
    if (hasLedger) {
      const todayTxs = this.salesTransactions.filter(t => {
        const txDateStr = getVietnamDateStr(t.confirmedAt || t.createdAt);
        return txDateStr === todayVietnamDateStr;
      });
      todayRevenue = todayTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const todayOrderIds = new Set(todayTxs.map(t => t.orderId));
      completedTodayCount = todayOrderIds.size;

      const todayItemRecords = this.salesTransactionItems.filter(ti => {
        const itemDateStr = getVietnamDateStr(ti.createdAt);
        return itemDateStr === todayVietnamDateStr;
      });
      totalItemsSoldToday = todayItemRecords.reduce((sum, ti) => sum + Number(ti.quantity || 1), 0);
    } else {
      const todayOrders = liveCompletedOrders.filter(o => getVietnamDateStr(o.completedAt) === todayVietnamDateStr);
      todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      completedTodayCount = todayOrders.length;
      totalItemsSoldToday = todayOrders.reduce((sum, o) => 
        sum + o.items.reduce((isum, it) => isum + Number(it.quantity || 1), 0), 0
      );
    }

    // 2. 7 Days Breakdown (Vietnam timezone)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = getVietnamDateStr(d);
      const dayName = i === 0 ? 'Hôm nay' : `${d.getDate()}/${d.getMonth() + 1}`;
      
      if (hasLedger) {
        const dayTxs = this.salesTransactions.filter(t => getVietnamDateStr(t.confirmedAt || t.createdAt) === dStr);
        const total = dayTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        last7Days.push({
          date: dStr,
          label: dayName,
          total,
          orderCount: dayTxs.length
        });
      } else {
        const dayMatches = liveCompletedOrders.filter(o => getVietnamDateStr(o.completedAt) === dStr);
        const total = dayMatches.reduce((sum, o) => sum + Number(o.total || 0), 0);
        last7Days.push({
          date: dStr,
          label: dayName,
          total,
          orderCount: dayMatches.length
        });
      }
    }

    // 3. 12 Months Breakdown for selectedYear (seamlessly combining live orders + snapshots)
    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const mNum = mIdx + 1;
      const mKey = `${currentYear}-${String(mNum).padStart(2, '0')}`;
      const snap = this.monthlyStatistics.find(s => s.month === mKey);

      let mTotal = 0;
      let mCount = 0;

      if (hasLedger) {
        const mTxs = this.salesTransactions.filter(t => {
          const tMonthStr = getVietnamYearMonth(t.confirmedAt || t.createdAt);
          return tMonthStr === mKey;
        });
        const ledgerRev = mTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const ledgerCount = new Set(mTxs.map(t => t.orderId)).size;
        mTotal = snap ? Math.max(snap.revenue, ledgerRev) : ledgerRev;
        mCount = snap ? Math.max(snap.completedOrders, ledgerCount) : ledgerCount;
      } else {
        const mOrders = liveCompletedOrders.filter(o => getVietnamYearMonth(o.completedAt) === mKey);
        const liveRev = mOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const liveCount = mOrders.length;
        mTotal = snap ? Math.max(snap.revenue, liveRev) : liveRev;
        mCount = snap ? Math.max(snap.completedOrders, liveCount) : liveCount;
      }

      monthlyBreakdown.push({
        month: mNum,
        label: `Tháng ${mNum}`,
        total: mTotal,
        orderCount: mCount
      });
    }

    // 4. Current Month & Selected Year Aggregations
    const currMonthReport = monthlyBreakdown.find(m => m.month === currentMonthNum);
    monthRevenue = currMonthReport ? currMonthReport.total : 0;
    yearRevenue = monthlyBreakdown.reduce((sum, m) => sum + m.total, 0);
    totalCompletedOrders = monthlyBreakdown.reduce((sum, m) => sum + m.orderCount, 0);

    // 5. Total Items Sold Year
    if (hasLedger) {
      const yearItemRecords = this.salesTransactionItems.filter(ti => {
        const yStr = getVietnamYearMonth(ti.createdAt).slice(0, 4);
        return parseInt(yStr, 10) === currentYear;
      });
      totalItemsSoldYear = yearItemRecords.reduce((sum, ti) => sum + Number(ti.quantity || 1), 0);
    } else {
      const yearLiveOrders = liveCompletedOrders.filter(o => {
        const yStr = getVietnamYearMonth(o.completedAt).slice(0, 4);
        return parseInt(yStr, 10) === currentYear;
      });
      const liveYearItems = yearLiveOrders.reduce((sum, o) =>
        sum + o.items.reduce((isum, it) => isum + Number(it.quantity || 1), 0), 0
      );
      const snapshotYearItems = this.monthlyStatistics
        .filter(s => s.month.startsWith(`${currentYear}-`))
        .reduce((sum, s) => sum + s.itemsSold, 0);
      totalItemsSoldYear = Math.max(liveYearItems, snapshotYearItems);
    }

    // 6. Top Selling Products Calculation (Filtered by selectedMonth if specified, or whole year)
    const productSalesMap: Record<string, { id: string; name: string; category: string; image: string; qty: number; rev: number }> = {};

    const targetMonthPrefix = selectedMonth
      ? `${currentYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${currentYear}-`;

    // Seed from snapshots for matching months
    const matchingSnapshots = this.monthlyStatistics.filter(s =>
      selectedMonth ? s.month === targetMonthPrefix : s.month.startsWith(targetMonthPrefix)
    );
    matchingSnapshots.forEach(snap => {
      snap.productStats?.forEach(p => {
        if (!productSalesMap[p.productId]) {
          productSalesMap[p.productId] = {
            id: p.productId,
            name: p.productName,
            category: p.category,
            image: p.image,
            qty: 0,
            rev: 0
          };
        }
        productSalesMap[p.productId].qty += p.quantity;
        productSalesMap[p.productId].rev += p.revenue;
      });
    });

    // Merge live orders for matching month/year (if not already represented)
    const matchingLiveOrders = liveCompletedOrders.filter(o => {
      const ym = getVietnamYearMonth(o.completedAt);
      return selectedMonth ? ym === targetMonthPrefix : ym.startsWith(targetMonthPrefix);
    });

    // If no snapshot exists for live orders' months, accumulate live items
    if (matchingSnapshots.length === 0 || matchingLiveOrders.length > 0) {
      matchingLiveOrders.forEach(order => {
        const oMonth = getVietnamYearMonth(order.completedAt);
        const hasSnapForMonth = this.monthlyStatistics.some(s => s.month === oMonth);
        if (!hasSnapForMonth) {
          order.items.forEach(item => {
            if (!productSalesMap[item.productId]) {
              const foundProd = this.products.find(p => p.id === item.productId);
              productSalesMap[item.productId] = {
                id: item.productId,
                name: item.productName,
                category: foundProd?.category || 'menu',
                image: item.image || foundProd?.image || '/coffee_img/1.png',
                qty: 0,
                rev: 0
              };
            }
            productSalesMap[item.productId].qty += Number(item.quantity || 1);
            productSalesMap[item.productId].rev += Number(item.totalPrice || (item.unitPrice * item.quantity));
          });
        }
      });
    }

    topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty || b.rev - a.rev)
      .slice(0, 10)
      .map(p => ({
        productId: p.id,
        productName: p.name,
        category: p.category,
        image: p.image,
        totalQuantity: p.qty,
        totalRevenue: p.rev
      }));

    const aov = totalCompletedOrders > 0 ? Math.round(yearRevenue / totalCompletedOrders) : 0;
    const newOrdersCount = this.orders.filter(o => o.status === 'NEW').length;
    const preparingCount = this.orders.filter(o => o.status === 'PREPARING' || o.status === 'CONFIRMED').length;
    const readyCount = this.orders.filter(o => o.status === 'READY').length;

    // Available Years
    const yearsSet = new Set<number>([now.getFullYear(), 2025, 2026]);
    this.salesTransactions.forEach(t => {
      if (t.confirmedAt) {
        const y = parseInt(getVietnamYearMonth(t.confirmedAt).slice(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    this.orders.forEach(o => {
      if (o.completedAt) {
        const y = parseInt(getVietnamYearMonth(o.completedAt).slice(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    this.monthlyStatistics.forEach(s => {
      const y = parseInt(s.month.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    // Selected Month Detail if selected
    let selectedMonthStats: MonthlyStatistics | null = null;
    if (selectedMonth) {
      const targetMStr = `${currentYear}-${String(selectedMonth).padStart(2, '0')}`;
      selectedMonthStats = this.getMonthlyStatsDetail(targetMStr);
    }

    return {
      todayRevenue,
      monthRevenue,
      yearRevenue,
      totalCompletedOrders,
      aov,
      newOrdersCount,
      preparingCount,
      readyCount,
      completedTodayCount,
      totalItemsSoldToday,
      totalItemsSoldYear,
      last7Days,
      monthlyBreakdown,
      topProducts,
      availableYears,
      selectedYear: currentYear,
      selectedMonth: selectedMonth || null,
      selectedMonthStats
    };
  }
}

export const storeService = new StoreService();

