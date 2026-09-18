import { AdminNotification, AdminNotificationEventType, OrderRecord } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { soundService } from './soundService';

const STORAGE_KEY = 'ana_admin_notifications';
const MAX_NOTIFICATIONS = 150;

type NotificationListener = (notification: AdminNotification, isRealtimePush: boolean) => void;
type UnreadCountListener = (count: number) => void;

class AdminNotificationService {
  private notifications: AdminNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private unreadListeners: Set<UnreadCountListener> = new Set();
  private seenNotificationIds: Set<string> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private realtimeChannel: any = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initData();
    this.initBroadcast();
    this.initSupabaseRealtime();
  }

  private initData() {
    if (this.isInitialized) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AdminNotification[] = JSON.parse(saved);
        this.notifications = Array.isArray(parsed) ? parsed : [];
        this.notifications.forEach(n => this.seenNotificationIds.add(n.id));
      }
    } catch {
      this.notifications = [];
    }

    this.isInitialized = true;
    this.fetchNotifications();
  }

  private initBroadcast() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel('ana_admin_notifications_channel');
      this.broadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'NEW_NOTIFICATION' && payload?.id) {
          if (!this.seenNotificationIds.has(payload.id)) {
            this.handleIncomingNotification(payload, true);
          }
        } else if (type === 'MARK_READ' && payload?.id) {
          this.applyMarkAsReadLocal(payload.id);
        } else if (type === 'MARK_ALL_READ') {
          this.applyMarkAllAsReadLocal();
        }
      };
    } catch {
      // ignore BroadcastChannel errors
    }
  }

  public initSupabaseRealtime() {
    if (!isSupabaseConfigured || !supabase) return;

    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {
        // ignore
      }
      this.realtimeChannel = null;
    }

    const channelName = `admin_notifications_realtime_${Math.random().toString(36).substring(2, 8)}`;
    this.realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          if (!raw || !raw.id) return;

          const notif = this.mapDbRowToNotification(raw);
          if (!this.seenNotificationIds.has(notif.id)) {
            this.handleIncomingNotification(notif, true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          if (!raw || !raw.id) return;

          const notifId = String(raw.id);
          const isRead = Boolean(raw.is_read);
          if (isRead) {
            this.applyMarkAsReadLocal(notifId);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[ADMIN NOTIFICATION] Subscribed to realtime admin_notifications');
        }
      });
  }

  public async fetchNotifications(): Promise<AdminNotification[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data) && data.length > 0) {
          const fetched = data.map(row => this.mapDbRowToNotification(row));
          
          // Merge with current notifications without duplicates
          const mergedMap = new Map<string, AdminNotification>();
          fetched.forEach(n => mergedMap.set(n.id, n));
          this.notifications.forEach(n => {
            if (!mergedMap.has(n.id)) {
              mergedMap.set(n.id, n);
            }
          });

          this.notifications = Array.from(mergedMap.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_NOTIFICATIONS);

          this.notifications.forEach(n => this.seenNotificationIds.add(n.id));
          this.saveLocal();
          this.emitUnreadChange();
        }
      } catch (err) {
        console.warn('[ADMIN NOTIFICATION] Supabase fetch error, using local data:', err);
      }
    }

    return this.getNotifications();
  }

  private mapDbRowToNotification(row: Record<string, unknown>): AdminNotification {
    return {
      id: String(row.id),
      eventType: (row.event_type as AdminNotificationEventType) || 'ORDER_CREATED',
      orderId: String(row.order_id || ''),
      orderNumber: String(row.order_number || ''),
      tableNumber: Number(row.table_number || 1),
      tableName: String(row.table_name || `Bàn số ${row.table_number || 1}`),
      title: String(row.title || ''),
      message: String(row.message || ''),
      metadata: typeof row.metadata === 'object' && row.metadata !== null ? (row.metadata as Record<string, unknown>) : undefined,
      isRead: Boolean(row.is_read),
      createdAt: String(row.created_at || new Date().toISOString())
    };
  }

  private handleIncomingNotification(notification: AdminNotification, playSound = true) {
    if (this.seenNotificationIds.has(notification.id)) return;
    this.seenNotificationIds.add(notification.id);

    // Insert at beginning
    this.notifications = [
      notification,
      ...this.notifications.filter(n => n.id !== notification.id)
    ].slice(0, MAX_NOTIFICATIONS);

    this.saveLocal();

    // Trigger sound
    if (playSound) {
      try {
        soundService.playNewOrderSound(notification.id);
      } catch {
        // ignore
      }
    }

    // Notify listeners (e.g. Toast, Center)
    this.listeners.forEach(cb => {
      try {
        cb(notification, playSound);
      } catch (e) {
        console.error('Error in notification listener:', e);
      }
    });

    this.emitUnreadChange();
  }

  public async createNotification(params: {
    eventType: AdminNotificationEventType;
    orderId: string;
    orderNumber: string;
    tableNumber: number;
    tableName: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<AdminNotification> {
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const notif: AdminNotification = {
      id: notifId,
      eventType: params.eventType,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      tableNumber: params.tableNumber,
      tableName: params.tableName,
      title: params.title,
      message: params.message,
      metadata: params.metadata,
      isRead: false,
      createdAt: now
    };

    // 1. Immediately handle locally
    this.handleIncomingNotification(notif, true);

    // 2. Broadcast to other tabs
    try {
      this.broadcastChannel?.postMessage({
        type: 'NEW_NOTIFICATION',
        payload: notif
      });
    } catch {
      // ignore
    }

    // 3. Persist to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('admin_notifications').insert({
          id: notif.id,
          event_type: notif.eventType,
          order_id: notif.orderId,
          order_number: notif.orderNumber,
          table_number: notif.tableNumber,
          table_name: notif.tableName,
          title: notif.title,
          message: notif.message,
          metadata: notif.metadata || {},
          is_read: false,
          created_at: notif.createdAt
        });

        if (error) {
          console.warn('[ADMIN NOTIFICATION] Supabase insert warning:', error.message);
        }
      } catch (err) {
        console.warn('[ADMIN NOTIFICATION] Supabase insert exception:', err);
      }
    }

    return notif;
  }

  public getNotifications(): AdminNotification[] {
    return [...this.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  public async markAsRead(id: string): Promise<void> {
    this.applyMarkAsReadLocal(id);

    try {
      this.broadcastChannel?.postMessage({
        type: 'MARK_READ',
        payload: { id }
      });
    } catch {
      // ignore
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('admin_notifications')
          .update({ is_read: true })
          .eq('id', id);
      } catch (err) {
        console.warn('[ADMIN NOTIFICATION] Supabase mark read error:', err);
      }
    }
  }

  private applyMarkAsReadLocal(id: string) {
    let changed = false;
    this.notifications = this.notifications.map(n => {
      if (n.id === id && !n.isRead) {
        changed = true;
        return { ...n, isRead: true };
      }
      return n;
    });

    if (changed) {
      this.saveLocal();
      this.emitUnreadChange();
    }
  }

  public async markAllAsRead(): Promise<void> {
    this.applyMarkAllAsReadLocal();

    try {
      this.broadcastChannel?.postMessage({
        type: 'MARK_ALL_READ'
      });
    } catch {
      // ignore
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('admin_notifications')
          .update({ is_read: true })
          .eq('is_read', false);
      } catch (err) {
        console.warn('[ADMIN NOTIFICATION] Supabase mark all read error:', err);
      }
    }
  }

  private applyMarkAllAsReadLocal() {
    this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
    this.saveLocal();
    this.emitUnreadChange();
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeUnread(listener: UnreadCountListener): () => void {
    this.unreadListeners.add(listener);
    listener(this.getUnreadCount());
    return () => {
      this.unreadListeners.delete(listener);
    };
  }

  private emitUnreadChange() {
    const count = this.getUnreadCount();
    this.unreadListeners.forEach(cb => {
      try {
        cb(count);
      } catch {
        // ignore
      }
    });
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
    } catch {
      // ignore
    }
  }

  // ========================================================
  // CONVENIENCE HELPERS FOR CUSTOMER ACTION EVENTS
  // ========================================================

  /**
   * 1. Customer created brand new order OR additional order
   */
  public async notifyOrderCreated(
    order: OrderRecord,
    isAdditional: boolean = false,
    sourceOrderNumber?: string
  ): Promise<AdminNotification> {
    const totalFormatted = (order.total * 1000).toLocaleString('vi-VN') + 'đ';
    const totalItems = (order.items || []).reduce((s, it) => s + it.quantity, 0);

    if (isAdditional) {
      const prevText = sourceOrderNumber ? ` sau đơn ${sourceOrderNumber}` : '';
      return this.createNotification({
        eventType: 'ADDITIONAL_ORDER_CREATED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        tableName: order.tableName,
        title: 'ĐƠN GỌI THÊM MỚI',
        message: `${order.orderNumber} • ${order.tableName} vừa tạo đơn gọi thêm${prevText} (${totalItems} món • ${totalFormatted})`,
        metadata: {
          itemsCount: totalItems,
          total: order.total,
          sourceOrderNumber
        }
      });
    }

    return this.createNotification({
      eventType: 'ORDER_CREATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: 'Đơn hàng mới',
      message: `${order.orderNumber} • ${order.tableName} vừa đặt ${totalItems} món (${totalFormatted})`,
      metadata: {
        itemsCount: totalItems,
        total: order.total
      }
    });
  }

  /**
   * 2. Customer added items to an existing open NEW order
   */
  public async notifyItemsAdded(
    order: OrderRecord,
    addedItems: { name: string; quantity: number }[],
    deltaTotal: number,
    newTotal?: number
  ): Promise<AdminNotification> {
    const deltaFormatted = (deltaTotal * 1000).toLocaleString('vi-VN') + 'đ';
    const totalFormatted = ((newTotal || order.total) * 1000).toLocaleString('vi-VN') + 'đ';
    const itemsSummary = addedItems.map(it => `+ ${it.name} ×${it.quantity}`).join(', ');
    const countItems = addedItems.reduce((acc, it) => acc + it.quantity, 0);

    return this.createNotification({
      eventType: 'ITEMS_ADDED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: '➕ KHÁCH GỌI THÊM MÓN',
      message: `${order.orderNumber} • ${order.tableName} vừa gọi thêm ${countItems} món: ${itemsSummary}. Số tiền gọi thêm: ${deltaFormatted} (Tổng đơn: ${totalFormatted})`,
      metadata: {
        addedItems,
        deltaTotal,
        newTotal: newTotal || order.total
      }
    });
  }

  /**
   * 3. Customer edited order (quantities, sizes, sugar, ice, toppings, notes)
   */
  public async notifyOrderUpdated(
    order: OrderRecord,
    diffSummary: string,
    details?: Record<string, unknown>
  ): Promise<AdminNotification> {
    return this.createNotification({
      eventType: 'ORDER_UPDATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: 'Đơn hàng được chỉnh sửa',
      message: `${order.orderNumber} • ${order.tableName} vừa chỉnh sửa: ${diffSummary}`,
      metadata: {
        diffSummary,
        ...details
      }
    });
  }

  /**
   * 4. Customer removed an item from order
   */
  public async notifyItemRemoved(
    order: OrderRecord,
    removedItemNames: string[],
    newTotal?: number
  ): Promise<AdminNotification> {
    const totalText = newTotal !== undefined ? ` • Tổng mới: ${(newTotal * 1000).toLocaleString('vi-VN')}đ` : '';
    const removedText = removedItemNames.join(', ');

    return this.createNotification({
      eventType: 'ITEM_REMOVED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: 'Đơn hàng được chỉnh sửa',
      message: `${order.orderNumber} • ${order.tableName} đã xóa: ${removedText}${totalText}`,
      metadata: {
        removedItems: removedItemNames,
        newTotal
      }
    });
  }

  /**
   * 5. Customer submitted transfer payment proof (or resubmitted after rejection)
   */
  public async notifyPaymentProofSubmitted(
    order: OrderRecord,
    isResubmission: boolean = false
  ): Promise<AdminNotification> {
    const totalFormatted = (order.total * 1000).toLocaleString('vi-VN') + 'đ';

    if (isResubmission) {
      return this.createNotification({
        eventType: 'PAYMENT_PROOF_RESUBMITTED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        tableName: order.tableName,
        title: 'Gửi lại ảnh thanh toán',
        message: `${order.orderNumber} • ${order.tableName} vừa gửi lại ảnh chuyển khoản (${totalFormatted})`,
        metadata: {
          total: order.total,
          proofPath: order.paymentProofPath
        }
      });
    }

    return this.createNotification({
      eventType: 'PAYMENT_PROOF_SUBMITTED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: 'Khách gửi thanh toán',
      message: `${order.orderNumber} • ${order.tableName} vừa gửi hình ảnh chuyển khoản (${totalFormatted})`,
      metadata: {
        total: order.total,
        proofPath: order.paymentProofPath
      }
    });
  }

  /**
   * 6. Customer cancelled order
   */
  public async notifyOrderCancelled(order: OrderRecord): Promise<AdminNotification> {
    return this.createNotification({
      eventType: 'ORDER_CANCELLED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      title: 'Đơn hàng đã bị hủy',
      message: `${order.orderNumber} • ${order.tableName} vừa hủy đơn hàng.`,
      metadata: {
        orderNumber: order.orderNumber
      }
    });
  }
}

export const adminNotificationService = new AdminNotificationService();
