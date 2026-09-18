export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'VERIFYING' | 'PAID' | 'REJECTED';

export interface Category {
  id: string;
  name: string;
  icon: string;
  image?: string;
  subtitle?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface TableAccount {
  id: string; // "table-1", "table-2", etc.
  name: string; // "Bàn số 1", "Bàn số 2", etc.
  tableNumber: number; // 1, 2, 3, 4, 5
  role: 'CUSTOMER' | 'ADMIN';
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN';
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: number; // in thousands (k) or VND
  priceFormatted: string; // e.g. "35K"
  rating: number;
  reviewCount: number;
  image: string;
  category: string;
  description?: string;
  isPopular?: boolean;
  isFavorite?: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isThaiSpecial?: boolean;
  displayOrder?: number;
  badge?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  sugarLevel?: string;
  iceLevel?: string;
  toppings?: string[];
  totalPrice: number;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedSize?: string;
  sugarLevel?: string;
  iceLevel?: string;
  toppings?: string[];
  totalPrice: number;
  image?: string;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
  revenueRecordedAt?: string;
  salesTransactionId?: string;
}

export interface SalesTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: number;
  tableName: string;
  paymentId?: string;
  paymentMethod: PaymentMethod;
  amount: number;
  totalItemsCount: number;
  confirmedBy?: string;
  confirmedAt: string;
  createdAt: string;
}

export interface SalesTransactionItem {
  id: string;
  salesTransactionId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedSize?: string;
  category?: string;
  image?: string;
  createdAt: string;
}

export interface OrderPaymentItemRecord {
  id: string;
  paymentId: string;
  orderItemId: string;
  orderId: string;
  amount: number;
  createdAt?: string;
}

export interface OrderPaymentRecord {
  id: string;
  orderId: string;
  batchNumber: number; // 1, 2, 3...
  amount: number; // in K
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentProofPath?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  paymentRejectionReason?: string;
  note?: string;
  createdAt: string;
  paidAt?: string;
  itemIds?: string[];
}

export interface OrderRecord {
  id: string;
  orderNumber: string; // e.g. "ANA-1028"
  tableNumber: number; // 1 to 5
  tableName: string; // "Bàn số 3"
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paidAmount?: number; // Total amount paid in K
  remainingAmount?: number; // Total unpaid amount in K
  payments?: OrderPaymentRecord[]; // History of payments
  note?: string;
  voucherCode?: string;
  items: OrderItemRecord[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentProofPath?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  paymentRejectionReason?: string;
  createdAt: string; // ISO 8601
  updatedAt?: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export function getOrderPaidAmount(order: OrderRecord): number {
  if (order.payments && order.payments.length > 0) {
    return order.payments
      .filter((p) => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }
  if (order.paidAmount !== undefined && order.paidAmount !== null) {
    return order.paidAmount;
  }
  return order.paymentStatus === 'PAID' ? order.total : 0;
}

export function getOrderRemainingAmount(order: OrderRecord): number {
  const paid = getOrderPaidAmount(order);
  return Math.max(0, order.total - paid);
}

export const ORDER_STATUS_PRIORITY: Record<OrderStatus, number> = {
  NEW: 1,        // Đơn mới khách vừa đặt (Luôn ưu tiên trên cùng)
  CONFIRMED: 2,  // Quán đã nhận
  PREPARING: 3,  // Đang làm món
  READY: 4,      // Sẵn sàng phục vụ
  COMPLETED: 5,  // Hoàn thành
  CANCELLED: 6   // Đã hủy
};

export function getOrderActivityTimestamp(order: OrderRecord): number {
  return Math.max(
    order.updatedAt ? new Date(order.updatedAt).getTime() : 0,
    order.confirmedAt ? new Date(order.confirmedAt).getTime() : 0,
    order.preparingAt ? new Date(order.preparingAt).getTime() : 0,
    order.readyAt ? new Date(order.readyAt).getTime() : 0,
    order.completedAt ? new Date(order.completedAt).getTime() : 0,
    order.cancelledAt ? new Date(order.cancelledAt).getTime() : 0,
    order.paymentVerifiedAt ? new Date(order.paymentVerifiedAt).getTime() : 0,
    order.paymentSubmittedAt ? new Date(order.paymentSubmittedAt).getTime() : 0,
    order.createdAt ? new Date(order.createdAt).getTime() : 0
  );
}

export function compareAdminOrders(a: OrderRecord, b: OrderRecord): number {
  // Sort by latest action / update / create timestamp descending
  // Newly placed, newly added items, edited or updated orders always float to the top
  const timeA = getOrderActivityTimestamp(a);
  const timeB = getOrderActivityTimestamp(b);
  if (timeB !== timeA) {
    return timeB - timeA;
  }

  // Fallback: highest orderNumber sequence first (e.g. ANA-1040 before ANA-1039)
  const numA = parseInt((a.orderNumber || '').replace(/\D/g, ''), 10) || 0;
  const numB = parseInt((b.orderNumber || '').replace(/\D/g, ''), 10) || 0;
  return numB - numA;
}

export function getOrderItemPaymentStatus(item: OrderItemRecord, order?: OrderRecord): PaymentStatus {
  if (item.paymentStatus) {
    return item.paymentStatus;
  }
  if (order) {
    if (order.paymentStatus === 'PAID') {
      return 'PAID';
    }
    if (item.paymentId && order.payments) {
      const match = order.payments.find(p => p.id === item.paymentId);
      if (match) return match.paymentStatus;
    }
  }
  return 'PENDING';
}

export function isOrderItemPaid(item: OrderItemRecord, order?: OrderRecord): boolean {
  return getOrderItemPaymentStatus(item, order) === 'PAID';
}

export interface Offer {
  id: string;
  title: string;
  code: string;
  discountAmount: number; // in K
  discountType: 'fixed' | 'percent' | 'freeship' | 'combo';
  minOrder: number; // in K
  description: string;
  expiryDate: string;
  category: 'all' | 'drinks' | 'food' | 'freeship';
  isSaved?: boolean;
  isExpired?: boolean;
  tag?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  currentPoints: number;
  nextTierPoints: number;
  joinedDate: string;
}

export interface OrderHistoryItem {
  id: string;
  orderNumber: string;
  date: string;
  itemsSummary: string;
  totalAmount: number;
  status: 'delivered' | 'processing' | 'cancelled';
  statusText: string;
  itemCount: number;
}

export interface RevenueDayReport {
  date: string; // YYYY-MM-DD
  label: string; // "Thứ 2", "13/09"
  total: number;
  orderCount: number;
}

export interface RevenueMonthReport {
  month: number; // 1 - 12
  year: number;
  label: string; // "Tháng 1/2026"
  total: number;
  orderCount: number;
}

export interface RevenueYearReport {
  year: number;
  total: number;
  orderCount: number;
  monthlyBreakdown: { month: number; total: number; orderCount: number }[];
}

export interface TopProductSales {
  productId: string;
  productName: string;
  category: string;
  image: string;
  totalQuantity: number;
  totalRevenue: number;
}

export type AdminNotificationEventType =
  | 'ORDER_CREATED'
  | 'ITEMS_ADDED'
  | 'ORDER_UPDATED'
  | 'ITEM_REMOVED'
  | 'PAYMENT_PROOF_SUBMITTED'
  | 'PAYMENT_PROOF_RESUBMITTED'
  | 'ORDER_CANCELLED'
  | 'ADDITIONAL_ORDER_CREATED';

export interface AdminNotification {
  id: string;
  eventType: AdminNotificationEventType;
  orderId: string;
  orderNumber: string;
  tableNumber: number;
  tableName: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
