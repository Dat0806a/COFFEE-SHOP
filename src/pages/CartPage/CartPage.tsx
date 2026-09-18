import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  Ticket,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ShoppingBag,
  Clock,
  Utensils,
  CheckCircle2,
  Receipt,
  FileText,
  ChefHat,
  Bell,
  CheckCheck,
  XCircle,
  Loader2,
  Edit3,
  CreditCard,
  Banknote,
  QrCode,
  Upload,
  Camera,
  AlertCircle
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useTableSession } from '../../context/TableSessionContext';
import { useStore } from '../../context/StoreContext';
import { PaymentMethod, getOrderPaidAmount, getOrderRemainingAmount, getOrderActivityTimestamp } from '../../types';
import { VoucherModal } from '../../components/modals/VoucherModal';
import { useDialog } from '../../context/DialogContext';
import './CartPage.css';

interface CartPageProps {
  onExploreMenu: () => void;
  onNavigateToMyOrders?: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onExploreMenu, onNavigateToMyOrders }) => {
  const { currentTable, sessionOrderIds, addSessionOrderId } = useTableSession();
  const {
    updateCustomerOrder,
    cancelCustomerOrder,
    submitCustomerCart,
    appendItemsToOrder,
    getTableOpenOrder,
    orders,
    products,
    editingOrderId,
    setEditingOrderId,
    uploadPaymentProof
  } = useStore();

  const {
    cartItems,
    totalCount,
    totalAmount,
    shippingFee,
    discountAmount,
    finalTotal,
    updateQuantity,
    removeFromCart,
    clearCart,
    appliedVoucher,
    applyVoucher,
    orderNote,
    setOrderNote,
    loadOrderIntoCart,
    appendToOrderId,
    setAppendToOrderId
  } = useCart();

  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const tableNumber = currentTable?.tableNumber || 1;

  // Retrieve stored active order ID for this table
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`ana_active_order_table_${currentTable?.tableNumber || 1}`) || null;
    } catch {
      return null;
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Target order to append items into if in Add More Mode
  const appendTargetOrder = appendToOrderId
    ? orders.find((o) => o.id === appendToOrderId) || null
    : null;

  const isTargetOrderActive = Boolean(
    appendTargetOrder &&
    appendTargetOrder.status !== 'COMPLETED' &&
    appendTargetOrder.status !== 'CANCELLED'
  );

  const isAddMoreMode = Boolean(isTargetOrderActive && !editingOrderId);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);
  const [isReuploading, setIsReuploading] = useState(false);

  // Service fee is completely removed (0)
  const effectiveDiscount = discountAmount;
  const effectiveTotal = Math.max(0, totalAmount - effectiveDiscount);

  // All orders of this table placed in THIS session, sorted latest active first
  const tableOrders = orders
    .filter((o) => o.tableNumber === tableNumber && sessionOrderIds.includes(o.id))
    .sort((a, b) => getOrderActivityTimestamp(b) - getOrderActivityTimestamp(a));

  // Find latest in-progress order for this table
  const tableProcessingOrder = tableOrders.find(
    (o) =>
      o.status === 'NEW' ||
      o.status === 'CONFIRMED' ||
      o.status === 'PREPARING' ||
      o.status === 'READY'
  ) || null;

  // Resolved placed order to track: only when explicitly set/tracked
  const currentPlacedOrder = activeOrderId
    ? orders.find((o) => o.id === activeOrderId) || null
    : null;

  const handleSetActiveOrderId = (id: string | null) => {
    setActiveOrderId(id);
    try {
      if (id) {
        localStorage.setItem(`ana_active_order_table_${tableNumber}`, id);
      } else {
        localStorage.removeItem(`ana_active_order_table_${tableNumber}`);
      }
    } catch {
      // ignore
    }
  };

  const editingOrder = editingOrderId
    ? orders.find((o) => o.id === editingOrderId) || null
    : null;

  // Auto-reset appendToOrderId if the target order is already completed or cancelled
  useEffect(() => {
    if (appendToOrderId && appendTargetOrder && (appendTargetOrder.status === 'COMPLETED' || appendTargetOrder.status === 'CANCELLED')) {
      setAppendToOrderId(null);
    }
  }, [appendToOrderId, appendTargetOrder, setAppendToOrderId]);

  const openOrder = getTableOpenOrder(tableNumber);

  const { showError, showAlert, showWarning, showSuccess, showConfirm } = useDialog();

  const handlePromptClearCart = () => {
    showConfirm({
      title: 'Xóa toàn bộ giỏ hàng?',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ món đang có trong giỏ hàng không?',
      confirmText: 'Xác nhận xóa',
      cancelText: 'Giữ lại',
      isDestructive: true,
      onConfirm: () => {
        clearCart();
      }
    });
  };

  const handlePromptRemoveItem = (itemId: string, productName: string) => {
    showConfirm({
      title: 'Xóa món khỏi giỏ?',
      message: `Bạn có chắc chắn muốn xóa món "${productName}" khỏi giỏ hàng?`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Giữ lại',
      isDestructive: true,
      onConfirm: () => {
        removeFromCart(itemId);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setFileError('Vui lòng chọn hình ảnh JPG, PNG hoặc WEBP hợp lệ.');
      showError({
        title: 'Định dạng không hợp lệ',
        message: 'Vui lòng chọn hình ảnh đuôi JPG, PNG hoặc WEBP hợp lệ.'
      });
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setFileError('Dung lượng ảnh không được vượt quá 5MB.');
      showError({
        title: 'Dung lượng ảnh quá lớn',
        message: 'Dung lượng hình ảnh không được vượt quá 5MB. Vui lòng chọn ảnh khác nhẹ hơn.'
      });
      return;
    }

    setProofFile(file);
    const localUrl = URL.createObjectURL(file);
    setProofPreviewUrl(localUrl);
  };

  const handleCheckout = async () => {
    if (isSubmitting || cartItems.length === 0) return;

    // Validation: Customer MUST select payment method before checkout
    if (!selectedPaymentMethod && !editingOrderId) {
      setPaymentMethodError('Vui lòng chọn phương thức thanh toán (Tiền mặt hoặc Chuyển khoản) trước khi đặt đơn.');
      showError({
        title: 'Chưa chọn phương thức thanh toán',
        message: 'Bạn bắt buộc phải chọn hình thức thanh toán (Tiền mặt hoặc Chuyển khoản) trước khi tiến hành đặt đơn.'
      });
      const sectionEl = document.getElementById('cart-payment-selector-section');
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (selectedPaymentMethod === 'BANK_TRANSFER' && !proofFile && !editingOrderId) {
      setFileError('Bắt buộc phải tải lên hình ảnh chuyển khoản trước khi đặt đơn.');
      showError({
        title: 'Bắt buộc gửi ảnh chuyển khoản',
        message: 'Với hình thức Chuyển khoản, bạn bắt buộc phải tải lên hình ảnh biên lai / giao dịch chuyển khoản thành công trước khi gửi đơn.'
      });
      const uploadEl = document.getElementById('payment-proof-file-input') || document.getElementById('cart-payment-selector-section');
      if (uploadEl) {
        uploadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = currentTable?.name || `Bàn số ${tableNumber}`;

      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        sugarLevel: item.sugarLevel,
        iceLevel: item.iceLevel,
        toppings: item.toppings,
        totalPrice: item.totalPrice,
        image: item.product.image
      }));

      // If in explicit EDIT EXISTING ORDER MODE:
      if (editingOrderId) {
        const res = await updateCustomerOrder(editingOrderId, {
          subtotal: totalAmount,
          discount: discountAmount,
          shippingFee,
          total: finalTotal,
          note: orderNote.trim() || undefined,
          voucherCode: appliedVoucher?.code,
          items: orderItems
        });

        if (!res.success) {
          showError({
            title: 'Không thể chỉnh sửa đơn',
            message: res.error || 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
          });
          setEditingOrderId(null);
          clearCart();
          setIsSubmitting(false);
          return;
        }

        const updatedId = editingOrderId;
        setEditingOrderId(null);
        clearCart();
        handleSetActiveOrderId(updatedId);
        showSuccess({
          title: 'Cập nhật thành công',
          message: 'Thay đổi đơn hàng của bạn đã được gửi tới quán thành công!'
        });
        setIsSubmitting(false);
        return;
      }

      // If in ADD MORE MODE:
      if (isAddMoreMode && appendTargetOrder) {
        if (appendTargetOrder.status === 'CANCELLED') {
          showError({
            title: 'Đơn hàng đã bị hủy',
            message: 'Đơn hàng này đã bị hủy nên không thể tiếp tục gọi thêm món.'
          });
          setAppendToOrderId(null);
          setIsSubmitting(false);
          return;
        }

        const paymentMethod = selectedPaymentMethod || 'CASH';
        const appendTotal = Math.max(0, totalAmount - effectiveDiscount);

        const res = await appendItemsToOrder({
          orderId: appendTargetOrder.id,
          items: orderItems,
          deltaSubtotal: totalAmount,
          deltaDiscount: effectiveDiscount,
          deltaTotal: appendTotal,
          paymentMethod,
          paymentProofFile: proofFile,
          note: orderNote.trim() || undefined,
          voucherCode: appliedVoucher?.code
        });

        if (!res.success) {
          showError({
            title: 'Không thể thêm món',
            message: res.error || 'Có lỗi khi thêm món vào đơn hàng.'
          });
          setIsSubmitting(false);
          return;
        }

        showSuccess({
          title: 'Gọi thêm món thành công!',
          message: `Các món mới đã được thêm vào đơn hàng #${appendTargetOrder.orderNumber}!`
        });

        clearCart();
        setAppendToOrderId(null);
        setProofFile(null);
        setProofPreviewUrl(null);
        setSelectedPaymentMethod(null);
        setPaymentMethodError(null);
        setFileError(null);
        addSessionOrderId(appendTargetOrder.id);
        handleSetActiveOrderId(appendTargetOrder.id);
        setIsSubmitting(false);
        return;
      }

      // Normal Checkout:
      const paymentMethod = selectedPaymentMethod || openOrder?.paymentMethod || 'CASH';
      const actualTotal = Math.max(0, totalAmount - discountAmount);

      const result = await submitCustomerCart({
        tableNumber,
        tableName,
        subtotal: totalAmount,
        discount: discountAmount,
        shippingFee: 0,
        total: actualTotal,
        note: orderNote.trim() || undefined,
        voucherCode: appliedVoucher?.code,
        paymentMethod,
        items: orderItems
      });

      // If Bank Transfer and proofFile was picked, upload proof to backend/Supabase
      if (paymentMethod === 'BANK_TRANSFER' && proofFile && result.order?.id) {
        try {
          await uploadPaymentProof(result.order.id, proofFile);
        } catch (uploadErr) {
          console.warn('Lỗi upload proof:', uploadErr);
        }
      }

      if (result.wasConfirmed) {
        showAlert({
          title: 'Đơn hàng mới đã được tạo',
          message: `Đơn hàng trước của bàn đã được quán xác nhận. Các món bạn vừa chọn đã được tạo thành đơn mới #${result.order.orderNumber}!`
        });
      } else if (result.isAppended) {
        showSuccess({
          title: 'Thêm món thành công',
          message: `Các món mới đã được thêm vào đơn hàng #${result.order.orderNumber} của bàn!`
        });
      }

      if (result.order?.id) {
        addSessionOrderId(result.order.id);
      }

      clearCart();
      setProofFile(null);
      setProofPreviewUrl(null);
      setSelectedPaymentMethod(null);
      setPaymentMethodError(null);
      setFileError(null);
      handleSetActiveOrderId(result.order.id);
    } catch (err: any) {
      console.error('Lỗi đặt món:', err);
      showError({
        title: 'Không thể gửi đơn hàng',
        message: err?.message || 'Có lỗi gián đoạn kết nối khi gửi đơn. Vui lòng kiểm tra lại mạng và thử lại.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReuploadProof = async (orderId: string, file: File) => {
    setIsReuploading(true);
    try {
      const res = await uploadPaymentProof(orderId, file);
      if (res.success) {
        showSuccess({
          title: 'Gửi ảnh thành công',
          message: 'Đã gửi lại hình ảnh thanh toán thành công. Quán đang kiểm tra lại giao dịch của bạn.'
        });
      } else {
        showError({
          title: 'Tải ảnh thất bại',
          message: res.error || 'Không thể upload hình ảnh. Vui lòng thử lại.'
        });
      }
    } catch {
      showError({
        title: 'Lỗi tải ảnh',
        message: 'Có lỗi xảy ra khi gửi lại ảnh thanh toán. Vui lòng thử lại.'
      });
    } finally {
      setIsReuploading(false);
    }
  };

  const handleStartEditCurrentOrder = () => {
    if (!currentPlacedOrder) return;
    if (currentPlacedOrder.status !== 'NEW') {
      showWarning({
        title: 'Không thể chỉnh sửa',
        message: 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
      });
      return;
    }
    loadOrderIntoCart(currentPlacedOrder, products);
    setEditingOrderId(currentPlacedOrder.id);
    handleSetActiveOrderId(null);
  };

  const handleCancelCurrentOrder = () => {
    if (!currentPlacedOrder) return;
    showConfirm({
      title: 'Xác nhận hủy đơn hàng?',
      message: `Bạn có chắc chắn muốn hủy đơn hàng #${currentPlacedOrder.orderNumber}? Mọi món ăn trong đơn sẽ bị hủy.`,
      confirmText: 'Xác nhận hủy đơn',
      cancelText: 'Không, giữ lại',
      isDestructive: true,
      onConfirm: async () => {
        setIsCancelling(true);
        const res = await cancelCustomerOrder(currentPlacedOrder.id);
        setIsCancelling(false);
        if (!res.success) {
          showError({
            title: 'Không thể hủy đơn',
            message: res.error || 'Đơn hàng đã được quán tiếp nhận nên không thể hủy vào lúc này.'
          });
        } else {
          handleSetActiveOrderId(null);
          showSuccess({
            title: 'Đã hủy đơn hàng',
            message: `Đơn hàng #${currentPlacedOrder.orderNumber} đã được hủy thành công.`
          });
        }
      }
    });
  };

  const handleCancelEditing = () => {
    showConfirm({
      title: 'Hủy chỉnh sửa đơn hàng?',
      message: 'Các thay đổi chưa lưu trong giỏ hàng sẽ bị hủy bỏ. Bạn có muốn quay lại đơn hàng?',
      confirmText: 'Hủy chỉnh sửa',
      cancelText: 'Tiếp tục sửa',
      isDestructive: true,
      onConfirm: () => {
        const prevId = editingOrderId;
        setEditingOrderId(null);
        clearCart();
        if (prevId) {
          handleSetActiveOrderId(prevId);
        }
      }
    });
  };

  // Only display order receipt/tracking view if:
  // 1. User has NO items in cart waiting to checkout (cartItems.length === 0)
  // 2. User is NOT currently editing an order (!editingOrderId)
  // 3. There is an active placed order being tracked (currentPlacedOrder)
  const isViewingPlacedOrder =
    cartItems.length === 0 &&
    !editingOrderId &&
    Boolean(currentPlacedOrder);

  if (isViewingPlacedOrder && currentPlacedOrder) {
    const totalOrderItemsCount = currentPlacedOrder.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const createdAtDate = new Date(currentPlacedOrder.createdAt);
    const timeFormatted = `${createdAtDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })} • ${createdAtDate.toLocaleDateString('vi-VN')}`;

    // Realtime status messages
    let statusTitle = 'Đã gửi đơn tới quán';
    let statusDesc = 'Quán đã nhận đơn và đang xếp thứ tự làm món.';
    let statusStep = 1;

    if (currentPlacedOrder.status === 'CONFIRMED') {
      statusTitle = 'Quán đã nhận đơn của bạn';
      statusDesc = 'Bếp đã xác nhận và chuẩn bị pha chế.';
      statusStep = 2;
    } else if (currentPlacedOrder.status === 'PREPARING') {
      statusTitle = 'Đơn hàng đang được chuẩn bị';
      statusDesc = 'Barista đang pha chế món uống tươi ngon cho bàn của bạn.';
      statusStep = 3;
    } else if (currentPlacedOrder.status === 'READY') {
      statusTitle = 'Món của bạn đã sẵn sàng!';
      statusDesc = 'Nhân viên đang mang món ra bàn số ' + currentPlacedOrder.tableNumber + '.';
      statusStep = 4;
    } else if (currentPlacedOrder.status === 'COMPLETED') {
      statusTitle = 'Đơn hàng đã hoàn thành';
      statusDesc = 'Chúc bạn có trải nghiệm thưởng thức thật ngon miệng!';
      statusStep = 5;
    } else if (currentPlacedOrder.status === 'CANCELLED') {
      statusTitle = 'Đơn hàng đã bị hủy';
      statusDesc = 'Đơn hàng này đã được hủy bỏ.';
      statusStep = 0;
    }

    const otherPendingOrders = tableOrders.filter(
      (o) =>
        o.id !== currentPlacedOrder.id &&
        (o.status === 'NEW' || o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY')
    );

    return (
      <div className="cart-page order-success-view">
        <div className="success-receipt-card">
          {/* Top Navigation Bar with Back Button */}
          <div className="success-top-nav-bar">
            <button
              className="success-nav-back-btn"
              onClick={() => {
                handleSetActiveOrderId(null);
                if (onNavigateToMyOrders) {
                  onNavigateToMyOrders();
                } else {
                  onExploreMenu();
                }
              }}
              aria-label="Quay lại các đơn đã đặt"
              title="Quay lại danh sách các đơn đã đặt"
            >
              <ChevronLeft size={18} />
              <span>Quay lại các đơn đã đặt</span>
            </button>

            {onNavigateToMyOrders && tableOrders.length > 1 && (
              <button
                className="success-nav-all-orders-btn"
                onClick={onNavigateToMyOrders}
                title="Xem tất cả đơn của bàn"
              >
                <Receipt size={14} />
                <span>Tất cả đơn ({tableOrders.length})</span>
              </button>
            )}
          </div>

          {/* Quick Switcher for Other Active Orders on this table */}
          {otherPendingOrders.length > 0 && (
            <div className="other-pending-orders-banner">
              <div className="other-pending-header">
                <span className="other-pending-tag">⏳ CÒN {otherPendingOrders.length} ĐƠN KHÁC ĐANG CHỜ PHỤC VỤ:</span>
              </div>
              <div className="other-pending-list">
                {otherPendingOrders.map((other) => (
                  <div
                    key={other.id}
                    className="other-pending-item"
                    onClick={() => handleSetActiveOrderId(other.id)}
                  >
                    <div className="other-pending-item-info">
                      <span className="other-pending-number">#{other.orderNumber}</span>
                      <span className={`other-pending-pill status-${other.status.toLowerCase()}`}>
                        {other.status === 'NEW' && 'Đã gửi'}
                        {other.status === 'CONFIRMED' && 'Đã nhận'}
                        {other.status === 'PREPARING' && 'Đang làm'}
                        {other.status === 'READY' && 'Sẵn sàng'}
                      </span>
                      <span className="other-pending-total">{(other.total * 1000).toLocaleString('vi-VN')}đ</span>
                    </div>
                    <button className="other-pending-view-btn" type="button">
                      <span>Xem đơn này</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Tracker Banner */}
          <div className="success-header">
            <div className={`success-icon-wrap status-icon-${currentPlacedOrder.status.toLowerCase()}`}>
              {currentPlacedOrder.status === 'NEW' && <Clock size={36} className="status-spin" />}
              {currentPlacedOrder.status === 'CONFIRMED' && <CheckCircle2 size={36} />}
              {currentPlacedOrder.status === 'PREPARING' && <ChefHat size={36} />}
              {currentPlacedOrder.status === 'READY' && <Bell size={36} className="status-ring" />}
              {currentPlacedOrder.status === 'COMPLETED' && <CheckCheck size={36} />}
              {currentPlacedOrder.status === 'CANCELLED' && <XCircle size={36} />}
            </div>

            <h2 className="success-title">{statusTitle}</h2>
            <p className="success-subtitle">{statusDesc}</p>

            {/* Realtime Progress Steps */}
            {currentPlacedOrder.status !== 'CANCELLED' && (
              <div className="customer-status-stepper">
                <div className={`step-node ${statusStep >= 1 ? 'active' : ''} ${statusStep > 1 ? 'done' : ''}`}>
                  <div className="step-circle">{statusStep > 1 ? '✓' : '●'}</div>
                  <span className="step-label">Đã gửi</span>
                </div>
                <div className={`step-line ${statusStep >= 2 ? 'active' : ''}`} />
                <div className={`step-node ${statusStep >= 2 ? 'active' : ''} ${statusStep > 2 ? 'done' : ''}`}>
                  <div className="step-circle">{statusStep > 2 ? '✓' : statusStep === 2 ? '●' : '○'}</div>
                  <span className="step-label">Nhận đơn</span>
                </div>
                <div className={`step-line ${statusStep >= 3 ? 'active' : ''}`} />
                <div className={`step-node ${statusStep >= 3 ? 'active' : ''} ${statusStep > 3 ? 'done' : ''}`}>
                  <div className="step-circle">{statusStep > 3 ? '✓' : statusStep === 3 ? '●' : '○'}</div>
                  <span className="step-label">Làm món</span>
                </div>
                <div className={`step-line ${statusStep >= 4 ? 'active' : ''}`} />
                <div className={`step-node ${statusStep >= 4 ? 'active' : ''} ${statusStep >= 5 ? 'done' : ''}`}>
                  <div className="step-circle">{statusStep >= 5 ? '✓' : statusStep === 4 ? '●' : '○'}</div>
                  <span className="step-label">Sẵn sàng</span>
                </div>
              </div>
            )}
          </div>

          {/* Status Notices */}
          {currentPlacedOrder.status === 'CONFIRMED' && (
            <div className="order-live-notice notice-lock">
              <span>🔒 Quán đã nhận đơn. Đơn không thể chỉnh sửa.</span>
            </div>
          )}

          {currentPlacedOrder.status === 'PREPARING' && (
            <div className="order-live-notice notice-prep">
              <span>🧑‍🍳 Quán đang chuẩn bị món cho bàn của bạn.</span>
            </div>
          )}

          {currentPlacedOrder.status === 'READY' && (
            <div className="order-live-notice notice-ready">
              <span>🎉 Món của bạn đã sẵn sàng! Nhân viên đang mang ra bàn.</span>
            </div>
          )}

          {currentPlacedOrder.status === 'COMPLETED' && (
            <div className="order-live-notice notice-done">
              <span>✨ Bạn đã nhận món. Cảm ơn bạn đã thưởng thức tại ANA Chiang Mai!</span>
            </div>
          )}

          {currentPlacedOrder.status === 'CANCELLED' && (
            <div className="order-live-notice notice-cancelled">
              <span>❌ Đơn hàng này đã bị hủy.</span>
            </div>
          )}

          {/* Order Meta Box */}
          <div className="receipt-meta-box">
            <div className="receipt-meta-row">
              <span className="receipt-meta-label">Mã đơn hàng:</span>
              <strong className="receipt-meta-code">{currentPlacedOrder.orderNumber}</strong>
            </div>

            <div className="receipt-meta-row">
              <div className="receipt-meta-left">
                <Clock size={14} className="receipt-meta-icon" />
                <span className="receipt-meta-label">Thời gian đặt:</span>
              </div>
              <strong className="receipt-meta-value">{timeFormatted}</strong>
            </div>

            <div className="receipt-meta-row">
              <div className="receipt-meta-left">
                <Utensils size={14} className="receipt-meta-icon" />
                <span className="receipt-meta-label">Bàn phục vụ:</span>
              </div>
              <strong className="receipt-meta-value highlight-table">{currentPlacedOrder.tableName}</strong>
            </div>

            {currentPlacedOrder.note && (
              <div className="receipt-meta-row note-row">
                <div className="receipt-meta-left">
                  <FileText size={14} className="receipt-meta-icon" />
                  <span className="receipt-meta-label">Ghi chú:</span>
                </div>
                <span className="receipt-meta-note">"{currentPlacedOrder.note}"</span>
              </div>
            )}
          </div>

          {/* Payment Status Section in Receipt */}
          <div className="receipt-payment-section">
            <div className="receipt-section-header">
              <CreditCard size={16} className="receipt-section-icon" />
              <h4 className="receipt-section-title">THANH TOÁN</h4>
            </div>

            <div className="receipt-payment-body">
              <div className="receipt-payment-row">
                <span className="payment-label">Phương thức:</span>
                <strong className="payment-val">
                  {currentPlacedOrder.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
                </strong>
              </div>

              <div className="receipt-payment-row">
                <span className="payment-label">Trạng thái:</span>
                <span className={`payment-status-badge pay-${currentPlacedOrder.paymentStatus?.toLowerCase() || 'pending'}`}>
                  {currentPlacedOrder.paymentStatus === 'PAID' && '✓ Đã thanh toán'}
                  {currentPlacedOrder.paymentStatus === 'VERIFYING' && 'Quán đang xác minh'}
                  {currentPlacedOrder.paymentStatus === 'PENDING' && (
                    currentPlacedOrder.paymentMethod === 'BANK_TRANSFER'
                      ? 'Chưa gửi hình ảnh thanh toán'
                      : 'Chờ thanh toán tại quầy'
                  )}
                  {currentPlacedOrder.paymentStatus === 'REJECTED' && '❌ Ảnh không hợp lệ'}
                </span>
              </div>

              {/* CASH Pending Instruction */}
              {currentPlacedOrder.paymentMethod === 'CASH' && currentPlacedOrder.paymentStatus === 'PENDING' && (
                <div className="payment-instruction-box cash-box">
                  <Banknote size={18} className="pay-box-icon" />
                  <div>
                    <strong>Vui lòng ra quầy trả tiền để xác nhận đơn</strong>
                    <p>Tổng thanh toán: {(currentPlacedOrder.total * 1000).toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              )}

              {/* BANK TRANSFER Verifying message & proof */}
              {currentPlacedOrder.paymentMethod === 'BANK_TRANSFER' && currentPlacedOrder.paymentStatus === 'VERIFYING' && (
                <div className="payment-instruction-box verifying-box">
                  <Clock size={18} className="pay-box-icon" />
                  <div>
                    <strong>Đã gửi hình ảnh thanh toán</strong>
                    <p>Quán đang kiểm tra giao dịch của bạn.</p>
                  </div>
                  {currentPlacedOrder.paymentProofPath && (
                    <div
                      className="proof-thumb-wrap"
                      onClick={() => setZoomProofUrl(currentPlacedOrder.paymentProofPath || null)}
                      title="Bấm để xem ảnh lớn"
                    >
                      <img
                        src={currentPlacedOrder.paymentProofPath}
                        alt="Ảnh thanh toán"
                        className="proof-thumb-img"
                      />
                      <span className="zoom-hint">🔍 Xem ảnh</span>
                    </div>
                  )}
                </div>
              )}

              {/* BANK TRANSFER Rejected message & reupload */}
              {currentPlacedOrder.paymentMethod === 'BANK_TRANSFER' && currentPlacedOrder.paymentStatus === 'REJECTED' && (
                <div className="payment-instruction-box rejected-box">
                  <AlertCircle size={18} className="pay-box-icon" />
                  <div>
                    <strong>Ảnh thanh toán chưa được xác nhận. Vui lòng gửi lại.</strong>
                    {currentPlacedOrder.paymentRejectionReason && (
                      <p className="reject-reason">Lý do: {currentPlacedOrder.paymentRejectionReason}</p>
                    )}
                  </div>

                  {/* Inline Re-upload Form */}
                  <div className="reupload-proof-form">
                    <label htmlFor={`reupload-proof-${currentPlacedOrder.id}`} className="reupload-picker-btn">
                      <Camera size={14} />
                      <span>{proofFile ? 'Đã chọn ảnh mới' : 'Chọn hình ảnh mới'}</span>
                    </label>
                    <input
                      id={`reupload-proof-${currentPlacedOrder.id}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />

                    {proofPreviewUrl && (
                      <div className="reupload-preview">
                        <img src={proofPreviewUrl} alt="Preview mới" className="reupload-thumb" />
                        <button
                          className="reupload-submit-btn"
                          disabled={isReuploading}
                          onClick={() => proofFile && handleReuploadProof(currentPlacedOrder.id, proofFile)}
                        >
                          {isReuploading ? 'Đang gửi...' : 'Gửi xác nhận thanh toán'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PAID Confirmation banner */}
              {currentPlacedOrder.paymentStatus === 'PAID' && (
                <div className="payment-instruction-box paid-box">
                  <CheckCircle2 size={18} className="pay-box-icon" />
                  <div>
                    <strong>✓ Thanh toán đã được xác nhận</strong>
                    <p>Đơn hàng sẵn sàng để bếp chuẩn bị.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ordered Items List */}
          <div className="receipt-items-section">
            <div className="receipt-section-header">
              <Receipt size={16} className="receipt-section-icon" />
              <h4 className="receipt-section-title">
                ĐƠN ĐẶT ({totalOrderItemsCount} món)
              </h4>
            </div>

            <div className="receipt-items-list">
              {currentPlacedOrder.items.map((item, idx) => {
                const optionsList: string[] = [];
                if (item.selectedSize) optionsList.push(`Size ${item.selectedSize}`);
                if (item.sugarLevel && item.sugarLevel !== '100%') optionsList.push(`Đường ${item.sugarLevel}`);
                else if (item.sugarLevel === '100%') optionsList.push('Đường 100%');
                if (item.iceLevel && item.iceLevel !== '100%') optionsList.push(`Đá ${item.iceLevel}`);
                else if (item.iceLevel === '100%') optionsList.push('Đá 100%');
                if (item.toppings && Array.isArray(item.toppings) && item.toppings.length > 0) {
                  optionsList.push(`+ ${item.toppings.join(', ')}`);
                }

                const optionsSummary = optionsList.join(' • ');

                return (
                  <div key={item.id || `placed-item-${idx}`} className="receipt-item-row">
                    <img
                      src={item.image || '/coffee_img/1.png'}
                      alt={item.productName}
                      className="receipt-item-img"
                    />
                    <div className="receipt-item-info">
                      <div className="receipt-item-title-row">
                        <span className="receipt-item-name">{item.productName}</span>
                        <span className="receipt-item-total">{item.totalPrice}K</span>
                      </div>
                      <div className="receipt-item-sub-row">
                        {optionsSummary ? (
                          <span className="receipt-item-opts">{optionsSummary}</span>
                        ) : (
                          <span className="receipt-item-opts">Tiêu chuẩn</span>
                        )}
                        <span className="receipt-item-qty">x{item.quantity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="receipt-billing-card">
            <div className="receipt-billing-row">
              <span>Tạm tính</span>
              <span>{currentPlacedOrder.subtotal}K</span>
            </div>

            {currentPlacedOrder.discount > 0 && (
              <div className="receipt-billing-row discount">
                <span>Ưu đãi {currentPlacedOrder.voucherCode ? `(${currentPlacedOrder.voucherCode})` : ''}</span>
                <span className="discount-val">-{currentPlacedOrder.discount}K</span>
              </div>
            )}

            {currentPlacedOrder.shippingFee > 0 && (
              <div className="receipt-billing-row">
                <span>Phí phục vụ</span>
                <span>{currentPlacedOrder.shippingFee}K</span>
              </div>
            )}

            <div className="receipt-billing-divider" />

            <div className="receipt-billing-row total">
              <span className="billing-total-label">Tổng đơn hàng</span>
              <span className="billing-total-value">{currentPlacedOrder.total}K</span>
            </div>

            <div className="receipt-billing-row paid-row">
              <span className="billing-paid-label">Đã thanh toán</span>
              <span className="billing-paid-value text-success font-semibold">{getOrderPaidAmount(currentPlacedOrder)}K</span>
            </div>

            {getOrderRemainingAmount(currentPlacedOrder) > 0 && (
              <div className="receipt-billing-row remaining-row">
                <span className="billing-remaining-label">Còn lại cần trả</span>
                <span className="billing-remaining-value text-danger font-semibold">{getOrderRemainingAmount(currentPlacedOrder)}K</span>
              </div>
            )}
          </div>

          {/* Payment History Section */}
          {currentPlacedOrder.payments && currentPlacedOrder.payments.length > 0 && (
            <div className="receipt-payments-history-section">
              <div className="receipt-section-header">
                <CreditCard size={16} className="receipt-section-icon" />
                <h4 className="receipt-section-title">
                  LỊCH SỬ THANH TOÁN ({currentPlacedOrder.payments.length} lượt)
                </h4>
              </div>
              <div className="receipt-payments-list">
                {currentPlacedOrder.payments.map((pay, pIdx) => {
                  const payTime = pay.createdAt
                    ? new Date(pay.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <div key={pay.id || `pay-batch-${pIdx}`} className="receipt-payment-item">
                      <div className="pay-item-header">
                        <span className="pay-batch-badge">Đợt #{pay.batchNumber}</span>
                        <span className="pay-batch-amount">{pay.amount}K</span>
                      </div>
                      <div className="pay-item-body">
                        <div className="pay-item-method">
                          <span>{pay.paymentMethod === 'BANK_TRANSFER' ? '💳 Chuyển khoản' : '💵 Tiền mặt'}</span>
                          {payTime && <span className="pay-time">• {payTime}</span>}
                        </div>
                        <div className={`pay-status-pill status-${pay.paymentStatus.toLowerCase()}`}>
                          {pay.paymentStatus === 'PAID' && '✓ Đã thanh toán'}
                          {pay.paymentStatus === 'VERIFYING' && '⏳ Chờ xác nhận ảnh'}
                          {pay.paymentStatus === 'PENDING' && 'Chờ thanh toán'}
                          {pay.paymentStatus === 'REJECTED' && '❌ Ảnh bị từ chối'}
                        </div>
                      </div>
                      {pay.paymentProofPath && (
                        <div
                          className="pay-proof-preview-row"
                          onClick={() => setZoomProofUrl(pay.paymentProofPath || null)}
                          title="Bấm để xem ảnh"
                        >
                          <img src={pay.paymentProofPath} alt="Bằng chứng" className="pay-proof-mini-thumb" />
                          <span className="pay-proof-hint">🔍 Xem ảnh chuyển khoản</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="receipt-actions-container">
            {currentPlacedOrder.status === 'NEW' &&
             currentPlacedOrder.paymentStatus !== 'PAID' &&
             !(currentPlacedOrder.paymentMethod === 'BANK_TRANSFER' && currentPlacedOrder.paymentStatus === 'VERIFYING') && (
              <div className="receipt-edit-actions-row">
                <button
                  className="receipt-edit-btn"
                  onClick={handleStartEditCurrentOrder}
                >
                  <Edit3 size={15} />
                  <span>Chỉnh sửa đơn</span>
                </button>

                <button
                  className="receipt-cancel-btn"
                  onClick={handleCancelCurrentOrder}
                  disabled={isCancelling}
                >
                  <Trash2 size={15} />
                  <span>{isCancelling ? 'Đang hủy...' : 'Hủy đơn'}</span>
                </button>
              </div>
            )}

            {currentPlacedOrder.status === 'COMPLETED' ? (
              <div className="order-live-notice notice-lock">
                <span>✓ Đơn hàng đã hoàn thành. Quý khách có thể bấm "Đặt đơn mới" để gọi món cho đơn hàng tiếp theo!</span>
              </div>
            ) : currentPlacedOrder.paymentStatus === 'PAID' ? (
              <div className="order-live-notice notice-lock">
                <span>✓ Đơn hàng đã được thanh toán đủ. Bấm "Tiếp tục gọi thêm món" để thêm món vào đơn #{currentPlacedOrder.orderNumber}.</span>
              </div>
            ) : null}

            {currentPlacedOrder.status === 'NEW' && currentPlacedOrder.paymentMethod === 'BANK_TRANSFER' && currentPlacedOrder.paymentStatus === 'VERIFYING' && (
              <div className="order-live-notice notice-lock">
                <span>🔒 Đơn hàng đang chờ quán xác minh hình ảnh chuyển khoản, tạm thời không thể chỉnh sửa.</span>
              </div>
            )}

            <button
              className="success-continue-btn"
              onClick={() => {
                if (currentPlacedOrder.status === 'COMPLETED' || currentPlacedOrder.status === 'CANCELLED') {
                  handleSetActiveOrderId(null);
                  setAppendToOrderId(null);
                  clearCart();
                  onExploreMenu();
                  return;
                }
                setAppendToOrderId(currentPlacedOrder.id);
                clearCart();
                onExploreMenu();
              }}
            >
              <span>{currentPlacedOrder.status === 'COMPLETED' || currentPlacedOrder.status === 'CANCELLED' ? 'Đặt đơn mới' : 'Tiếp tục gọi thêm món'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Modal Zoom Proof */}
        {zoomProofUrl && (
          <div className="proof-zoom-modal-backdrop" onClick={() => setZoomProofUrl(null)}>
            <div className="proof-zoom-modal-content" onClick={e => e.stopPropagation()}>
              <div className="proof-zoom-header">
                <h4>Hình ảnh thanh toán</h4>
                <button className="proof-zoom-close" onClick={() => setZoomProofUrl(null)}>
                  <XCircle size={22} />
                </button>
              </div>
              <img src={zoomProofUrl} alt="Hình ảnh thanh toán lớn" className="proof-zoom-img" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="cart-page empty-cart-view">
        <header className="cart-header">
          <h1 className="cart-title">Giỏ hàng</h1>
        </header>

        <div className="empty-cart-content">
          <div className="empty-cart-illustration">
            <ShoppingBag size={54} strokeWidth={1.5} color="#B68438" />
          </div>
          <h3 className="empty-cart-title">Giỏ hàng của bạn đang trống</h3>
          <p className="empty-cart-subtitle">
            Chọn một món ngon mang hương vị Chiang Mai nhé.
          </p>
          <button className="empty-cart-cta-btn" onClick={onExploreMenu}>
            <span>Khám phá thực đơn</span>
            <ArrowRight size={16} />
          </button>

          {/* Quick link to view ongoing order if table has one */}
          {tableProcessingOrder && (
            <div className="empty-cart-active-order-card">
              <div className="empty-order-card-left">
                <div className="empty-order-icon-wrap">
                  <Clock size={18} className="status-spin" />
                </div>
                <div className="empty-order-info">
                  <span className="empty-order-num">Đơn hàng #{tableProcessingOrder.orderNumber}</span>
                  <span className="empty-order-status">
                    {tableProcessingOrder.status === 'NEW' && 'Đã gửi • Đang chờ nhận đơn'}
                    {tableProcessingOrder.status === 'CONFIRMED' && 'Quán đã nhận đơn'}
                    {tableProcessingOrder.status === 'PREPARING' && 'Đang pha chế'}
                    {tableProcessingOrder.status === 'READY' && 'Món đã sẵn sàng phục vụ'}
                  </span>
                </div>
              </div>
              <button
                className="empty-track-order-btn"
                onClick={() => handleSetActiveOrderId(tableProcessingOrder.id)}
              >
                <span>Xem đơn</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const orderNumberPreview = isAddMoreMode && appendTargetOrder
    ? appendTargetOrder.orderNumber.replace('ANA-', '')
    : openOrder
    ? openOrder.orderNumber.replace('ANA-', '')
    : '1025';

  return (
    <div className="cart-page">
      {/* Edit Mode Top Banner */}
      {editingOrderId && (
        <div className="cart-edit-mode-banner">
          <div className="edit-banner-left">
            <span className="edit-banner-tag">CHẾ ĐỘ CHỈNH SỬA</span>
            <strong className="edit-banner-title">Đơn hàng #{editingOrder?.orderNumber}</strong>
          </div>
          <button className="edit-cancel-btn" onClick={handleCancelEditing}>
            <span>Hủy chỉnh sửa</span>
          </button>
        </div>
      )}

      {/* Add More Mode Top Banner */}
      {isAddMoreMode && appendTargetOrder && (
        <div className="cart-add-more-mode-banner">
          <div className="add-more-banner-left">
            <span className="add-more-banner-tag">➕ GỌI THÊM MÓN</span>
            <div className="add-more-banner-text">
              <span>Đang thêm món vào đơn <strong>#{appendTargetOrder.orderNumber}</strong> ({appendTargetOrder.tableName})</span>
              <span className="add-more-sub">Chỉ thanh toán số tiền của các món gọi thêm này.</span>
            </div>
          </div>
          <button
            className="add-more-cancel-btn"
            onClick={() => {
              showConfirm({
                title: 'Hủy gọi thêm vào đơn?',
                message: `Bạn có muốn hủy chế độ gọi thêm vào đơn #${appendTargetOrder.orderNumber} và chuyển sang tạo đơn mới?`,
                confirmText: 'Tạo đơn mới',
                cancelText: 'Giữ lại',
                isDestructive: true,
                onConfirm: () => setAppendToOrderId(null)
              });
            }}
          >
            <span>Tạo đơn mới</span>
          </button>
        </div>
      )}

      {/* Open Order Append Banner (only if not in explicit add-more mode) */}
      {!isAddMoreMode && openOrder && !editingOrderId && (
        <div className="cart-open-order-banner">
          <Clock size={16} className="open-order-banner-icon" />
          <div className="open-order-banner-text">
            <span>Bàn của bạn đang có đơn <strong>#{openOrder.orderNumber}</strong> (Đã gửi).</span>
            <span className="open-order-sub">Các món bạn chọn sẽ được tự động thêm vào đơn này.</span>
          </div>
        </div>
      )}

      {/* Notice if table has an ongoing order already confirmed or being prepared */}
      {!isAddMoreMode && !openOrder && tableProcessingOrder && !editingOrderId && (
        <div className="cart-open-order-banner new-sub-order-banner">
          <CheckCircle2 size={16} className="open-order-banner-icon" />
          <div className="open-order-banner-text">
            <span>Đơn <strong>#{tableProcessingOrder.orderNumber}</strong> trước đó đang được phục vụ.</span>
            <span className="open-order-sub">Các món bạn vừa chọn sẽ được tạo thành đơn gọi món tiếp theo.</span>
          </div>
        </div>
      )}

      {/* 1. Header */}
      <header className="cart-header">
        <div className="cart-header-left">
          <h1 className="cart-title">
            {editingOrderId
              ? 'Sửa món trong đơn'
              : isAddMoreMode && appendTargetOrder
              ? `Gọi thêm vào #${appendTargetOrder.orderNumber}`
              : openOrder
              ? 'Gọi thêm món'
              : 'Giỏ hàng'}
          </h1>
          <span className="cart-count-badge">{totalCount} món</span>
        </div>
        {!editingOrderId && (
          <button
            className="cart-clear-btn"
            onClick={handlePromptClearCart}
            aria-label="Xóa tất cả món trong giỏ hàng"
          >
            <Trash2 size={15} />
            <span>Xóa tất cả</span>
          </button>
        )}
      </header>

      <div className="cart-body-content">
        {/* 2. Cart Items List */}
        <div className="cart-items-section">
          {cartItems.map((item) => {
            const itemId = item.id || item.product.id;
            const optionsSummary = [
              item.selectedSize ? `Size ${item.selectedSize}` : null,
              item.sugarLevel ? `${item.sugarLevel} đường` : null,
              item.iceLevel ? (item.iceLevel === '0%' ? 'Không đá' : `${item.iceLevel} đá`) : null,
              ...(item.toppings || [])
            ]
              .filter(Boolean)
              .join(' • ');

            return (
              <div key={itemId} className="cart-item-card">
                {/* Thumbnail */}
                <div className="cart-item-thumb">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="cart-thumb-img"
                  />
                </div>

                {/* Info */}
                <div className="cart-item-details">
                  <div className="cart-item-head">
                    <h4 className="cart-item-name">{item.product.name}</h4>
                    <button
                      className="cart-item-remove-btn"
                      onClick={() => handlePromptRemoveItem(itemId, item.product.name)}
                      aria-label="Xóa món này"
                    >
                      ×
                    </button>
                  </div>

                  {optionsSummary && (
                    <span className="cart-item-options">{optionsSummary}</span>
                  )}

                  <div className="cart-item-bottom">
                    <span className="cart-item-price">{item.totalPrice}K</span>

                    {/* Quantity Stepper */}
                    <div className="quantity-stepper">
                      <button
                        className="stepper-btn minus"
                        onClick={() => {
                          if (item.quantity === 1) {
                            handlePromptRemoveItem(itemId, item.product.name);
                          } else {
                            updateQuantity(itemId, -1);
                          }
                        }}
                        aria-label="Giảm số lượng"
                      >
                        <Minus size={13} strokeWidth={2.5} />
                      </button>
                      <span className="stepper-value">{item.quantity}</span>
                      <button
                        className="stepper-btn plus"
                        onClick={() => updateQuantity(itemId, 1)}
                        aria-label="Tăng số lượng"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Special Notes for Kitchen */}
        <div className="cart-note-section">
          <label htmlFor="order-note-input" className="section-label">
            Ghi chú cho quán
          </label>
          <input
            id="order-note-input"
            type="text"
            className="cart-note-input"
            placeholder="Ví dụ: ít đá hơn, giao trước 18h..."
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
          />
        </div>

        {/* 4. Voucher Selector Card */}
        <div className="cart-voucher-section" onClick={() => setIsVoucherModalOpen(true)}>
          <div className="voucher-row-left">
            <Ticket size={18} color="#8C5318" className="voucher-row-icon" />
            <div className="voucher-row-text">
              <span className="voucher-row-title">Ưu đãi / Mã giảm giá</span>
              <span className="voucher-row-sub">
                {appliedVoucher ? `${appliedVoucher.title} (${appliedVoucher.code})` : 'Chọn hoặc nhập mã ưu đãi'}
              </span>
            </div>
          </div>
          <div className="voucher-row-right">
            {appliedVoucher ? (
              <span className="applied-pill">Đã áp dụng</span>
            ) : (
              <ChevronRight size={16} color="#7A6F64" />
            )}
          </div>
        </div>

        {/* 5. Payment Method Selector Section (Mandatory Selection) */}
        {!editingOrderId && (
          <div
            id="cart-payment-selector-section"
            className={`cart-payment-selector-section ${paymentMethodError ? 'has-error' : ''}`}
          >
            <div className="payment-heading-row">
              <label className="section-label payment-heading">
                PHƯƠNG THỨC THANH TOÁN
              </label>
              <span className="payment-required-badge">* Bắt buộc</span>
            </div>

            {paymentMethodError && (
              <div className="payment-error-banner">
                <AlertCircle size={15} />
                <span>{paymentMethodError}</span>
              </div>
            )}

            <div className="payment-options-grid">
              {/* Option 1: Cash */}
              <div
                className={`payment-option-card ${selectedPaymentMethod === 'CASH' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedPaymentMethod('CASH');
                  setPaymentMethodError(null);
                }}
              >
                <div className="pay-card-radio">
                  <div className={`radio-dot ${selectedPaymentMethod === 'CASH' ? 'active' : ''}`} />
                </div>
                <div className="pay-card-icon-wrap">
                  <Banknote size={20} className="pay-icon" />
                </div>
                <div className="pay-card-text">
                  <div className="pay-method-title-row">
                    <strong className="pay-method-title">Tiền mặt</strong>
                  </div>
                  <span className="pay-method-desc">Thanh toán trực tiếp tại quầy</span>
                </div>
              </div>

              {/* Option 2: Bank Transfer */}
              <div
                className={`payment-option-card ${selectedPaymentMethod === 'BANK_TRANSFER' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedPaymentMethod('BANK_TRANSFER');
                  setPaymentMethodError(null);
                }}
              >
                <div className="pay-card-radio">
                  <div className={`radio-dot ${selectedPaymentMethod === 'BANK_TRANSFER' ? 'active' : ''}`} />
                </div>
                <div className="pay-card-icon-wrap">
                  <QrCode size={20} className="pay-icon" />
                </div>
                <div className="pay-card-text">
                  <div className="pay-method-title-row">
                    <strong className="pay-method-title">Chuyển khoản</strong>
                  </div>
                  <span className="pay-method-desc">Quét QR & đính kèm ảnh chuyển khoản</span>
                </div>
              </div>
            </div>

            {/* If CASH Selected: Cash instructions box */}
            {selectedPaymentMethod === 'CASH' && (
              <div className="selected-cash-details-box">
                <div className="cash-box-header">
                  <Banknote size={18} color="#8C5318" />
                  <strong>Thanh toán tiền mặt</strong>
                </div>
                <p className="cash-instruction-text">
                  Vui lòng ra quầy trả tiền để xác nhận đơn
                </p>
                <div className="cash-total-row">
                  <span>Tổng thanh toán:</span>
                  <strong className="cash-total-num">{(effectiveTotal * 1000).toLocaleString('vi-VN')}đ</strong>
                </div>
              </div>
            )}

            {/* If BANK TRANSFER Selected: QR + Proof upload box */}
            {selectedPaymentMethod === 'BANK_TRANSFER' && (
              <div className="selected-bank-details-box">
                <h4 className="bank-box-title">Quét mã để chuyển khoản</h4>

                {/* QR Code Placeholder */}
                <div className="bank-qr-container">
                  <img
                    src="/images/payment/qr-placeholder.svg"
                    alt="Mã QR Chuyển khoản"
                    className="payment-qr-image"
                  />
                </div>

                <div className="bank-transfer-info-card">
                  <div className="transfer-info-row">
                    <span>Tổng tiền:</span>
                    <strong className="transfer-amount">{(effectiveTotal * 1000).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div className="transfer-info-row">
                    <span>Nội dung chuyển khoản:</span>
                    <strong className="transfer-content-code">ANA{orderNumberPreview} BAN{tableNumber}</strong>
                  </div>
                </div>

                {/* Proof Image Upload Section */}
                <div className="proof-upload-section">
                  <label className="proof-upload-label">
                    Gửi hình ảnh thanh toán vào đây <span className="proof-required-tag">* (Bắt buộc)</span>
                  </label>
                  <p className="proof-upload-note">
                    Vui lòng tải lên ảnh chụp màn hình chuyển khoản thành công để quán xác nhận đơn hàng.
                  </p>

                  <input
                    id="payment-proof-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  {fileError && (
                    <div className="proof-error-msg">
                      <AlertCircle size={14} />
                      <span>{fileError}</span>
                    </div>
                  )}

                  {!proofPreviewUrl ? (
                    <label htmlFor="payment-proof-file-input" className="proof-pick-btn">
                      <Upload size={16} />
                      <span>Chọn hình ảnh</span>
                    </label>
                  ) : (
                    <div className="proof-selected-preview-box">
                      <div className="proof-preview-image-wrap">
                        <img src={proofPreviewUrl} alt="Preview thanh toán" className="proof-img-preview" />
                      </div>
                      <div className="proof-preview-actions">
                        <span className="proof-selected-badge">✓ Đã chọn hình ảnh thanh toán</span>
                        <label htmlFor="payment-proof-file-input" className="proof-change-btn">
                          Thay đổi ảnh
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. Order Summary Card */}
        <div className="order-summary-card">
          <h4 className="summary-title">Chi tiết thanh toán</h4>

          <div className="summary-row">
            <span className="summary-label">Tạm tính ({totalCount} món)</span>
            <span className="summary-value">{totalAmount}K</span>
          </div>

          {appliedVoucher && discountAmount > 0 && (
            <div className="summary-row discount">
              <span className="summary-label">Giảm giá ({appliedVoucher.code})</span>
              <span className="summary-value discount-val">-{discountAmount}K</span>
            </div>
          )}



          <div className="summary-divider" />

          <div className="summary-row total">
            <span className="summary-total-label">
              {isAddMoreMode ? 'Tổng cần thanh toán' : 'Tổng cộng'}
            </span>
            <span className="summary-total-value">{effectiveTotal}K</span>
          </div>
        </div>
      </div>

      {/* 7. Sticky Bottom Checkout CTA */}
      <div className="cart-checkout-sticky-bar">
        <button
          className={`cart-checkout-btn ${editingOrderId ? 'edit-mode-btn' : isAddMoreMode ? 'add-more-mode-btn' : openOrder ? 'append-mode-btn' : ''}`}
          onClick={handleCheckout}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="auth-spinner" />
              <span>
                {editingOrderId
                  ? 'Đang lưu thay đổi...'
                  : isAddMoreMode
                  ? 'Đang thêm món vào đơn...'
                  : openOrder
                  ? 'Đang thêm món vào đơn...'
                  : 'Đang gửi đơn tới quán...'}
              </span>
            </>
          ) : (
            <>
              <span>
                {editingOrderId
                  ? `Lưu thay đổi đơn hàng • ${finalTotal}K`
                  : isAddMoreMode && appendTargetOrder
                  ? `Xác nhận gọi thêm vào #${appendTargetOrder.orderNumber} • ${effectiveTotal}K`
                  : openOrder
                  ? `Thêm món vào đơn #${openOrder.orderNumber} • ${finalTotal}K`
                  : `Đặt món • ${finalTotal}K`}
              </span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* Voucher Selector Modal */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        selectedVoucher={appliedVoucher}
        onSelectVoucher={applyVoucher}
        onClose={() => setIsVoucherModalOpen(false)}
      />
    </div>
  );
};
