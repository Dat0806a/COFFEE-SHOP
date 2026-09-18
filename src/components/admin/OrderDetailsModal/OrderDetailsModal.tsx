import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  Utensils,
  Receipt,
  FileText,
  Check,
  ChefHat,
  Bell,
  CheckCheck,
  XCircle,
  Tag,
  CreditCard,
  ZoomIn,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { OrderRecord, OrderStatus, getOrderPaidAmount, getOrderRemainingAmount } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { useDialog } from '../../../context/DialogContext';
import './OrderDetailsModal.css';

interface OrderDetailsModalProps {
  order: OrderRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus
}) => {
  const { fetchOrderById, verifyPayment, rejectPayment, adminPaySelectedItems, adminPayAllRemainingItems } = useStore();
  const { showError, showWarning, showSuccess, showConfirm } = useDialog();
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && order?.id) {
      fetchOrderById(order.id);
      setSelectedItemIds([]);
    }
  }, [isOpen, order?.id, fetchOrderById]);

  if (!isOpen || !order) return null;

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const createdAtDate = new Date(order.createdAt);
  const timeFormatted = createdAtDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dateFormatted = createdAtDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'NEW':
        return 'ĐƠN MỚI';
      case 'CONFIRMED':
        return 'ĐÃ XÁC NHẬN';
      case 'PREPARING':
        return 'ĐANG CHUẨN BỊ';
      case 'READY':
        return 'SẴN SÀNG';
      case 'COMPLETED':
        return 'HOÀN THÀNH';
      case 'CANCELLED':
        return 'ĐÃ HỦY';
      default:
        return status;
    }
  };

  const isPaid = order.paymentStatus === 'PAID';
  const paidAmount = getOrderPaidAmount(order);
  const remainingAmount = getOrderRemainingAmount(order);

  const selectableItems = order.items.filter(
    it => it.paymentStatus !== 'PAID' && it.paymentStatus !== 'VERIFYING'
  );
  const isAllSelectableSelected = selectableItems.length > 0 && selectableItems.every(it => selectedItemIds.includes(it.id));
  const selectedItemsList = order.items.filter(it => selectedItemIds.includes(it.id));
  const selectedTotal = selectedItemsList.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelectableSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(selectableItems.map(it => it.id));
    }
  };

  const handleConfirmSelectedPayment = () => {
    if (selectedItemIds.length === 0) return;
    showConfirm({
      title: 'Xác nhận thanh toán các món đã chọn?',
      message: `Xác nhận thu ${formatVND(selectedTotal)} cho ${selectedItemsList.length} món đã chọn của đơn #${order.orderNumber} (${order.tableName})?`,
      confirmText: 'Xác nhận ĐÃ THU TIỀN',
      cancelText: 'Đóng',
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await adminPaySelectedItems(order.id, selectedItemIds, 'CASH', 'Admin');
          if (res.success) {
            setSelectedItemIds([]);
            showSuccess({
              title: 'Thành công',
              message: `Đã xác nhận thanh toán ${formatVND(selectedTotal)} cho ${selectedItemsList.length} món.`
            });
          } else {
            showError({
              title: 'Lỗi xác nhận',
              message: res.error || 'Có lỗi khi xác nhận thanh toán.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi xác nhận',
            message: 'Có lỗi xảy ra trong quá trình xác nhận thanh toán.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  const handlePayAllRemaining = () => {
    if (remainingAmount <= 0) return;
    showConfirm({
      title: 'Thanh toán toàn bộ phần còn lại?',
      message: `Xác nhận thu đủ ${formatVND(remainingAmount)} cho toàn bộ các món chưa thanh toán của đơn #${order.orderNumber} (${order.tableName})?`,
      confirmText: `Xác nhận thu ${formatVND(remainingAmount)}`,
      cancelText: 'Đóng',
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await adminPayAllRemainingItems(order.id, 'CASH', 'Admin');
          if (res.success) {
            setSelectedItemIds([]);
            showSuccess({
              title: 'Thành công',
              message: `Đã xác nhận thanh toán toàn bộ phần còn lại (${formatVND(remainingAmount)}) cho đơn #${order.orderNumber}.`
            });
          } else {
            showError({
              title: 'Lỗi xác nhận',
              message: res.error || 'Có lỗi khi xác nhận thanh toán.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi xác nhận',
            message: 'Có lỗi xảy ra trong quá trình xác nhận thanh toán.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  const handleVerifyPayment = () => {
    showConfirm({
      title: 'Xác nhận thanh toán?',
      message: `Xác nhận đơn hàng #${order.orderNumber} (${order.tableName}) đã thanh toán đủ ${formatVND(order.total)}?`,
      confirmText: 'Xác nhận ĐÃ THU TIỀN',
      cancelText: 'Đóng',
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await verifyPayment(order.id, 'Admin');
          if (res.success) {
            showSuccess({
              title: 'Thành công',
              message: `Đã xác nhận thanh toán thành công cho đơn #${order.orderNumber}.`
            });
          } else {
            showError({
              title: 'Lỗi xác nhận',
              message: res.error || 'Có lỗi khi xác nhận thanh toán.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi xác nhận',
            message: 'Có lỗi xảy ra trong quá trình xác nhận thanh toán.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  const handleRejectPayment = () => {
    showConfirm({
      title: 'Từ chối ảnh thanh toán?',
      message: `Bạn có chắc chắn muốn từ chối ảnh chuyển khoản của đơn #${order.orderNumber}? Khách sẽ nhận được thông báo yêu cầu gửi lại ảnh mới.`,
      confirmText: 'Xác nhận từ chối ảnh',
      cancelText: 'Hủy bỏ',
      isDestructive: true,
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await rejectPayment(order.id, 'Hình ảnh thanh toán mờ hoặc không hợp lệ');
          if (res.success) {
            showSuccess({
              title: 'Đã từ chối ảnh',
              message: `Đã gửi thông báo yêu cầu gửi lại ảnh thanh toán cho bàn số ${order.tableNumber}.`
            });
          } else {
            showError({
              title: 'Lỗi từ chối ảnh',
              message: res.error || 'Có lỗi khi từ chối ảnh thanh toán.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi từ chối ảnh',
            message: 'Có lỗi xảy ra khi từ chối ảnh thanh toán.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  const handleVerifyBatchPayment = (paymentId: string, amount: number) => {
    showConfirm({
      title: 'Xác nhận thu tiền đợt này?',
      message: `Xác nhận đợt thanh toán ${formatVND(amount)} của đơn #${order.orderNumber} (${order.tableName})?`,
      confirmText: 'Xác nhận ĐÃ THU TIỀN',
      cancelText: 'Đóng',
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await verifyPayment(order.id, paymentId, 'Admin');
          if (res.success) {
            showSuccess({
              title: 'Thành công',
              message: `Đã xác nhận thanh toán đợt ${formatVND(amount)} thành công.`
            });
          } else {
            showError({
              title: 'Lỗi xác nhận',
              message: res.error || 'Có lỗi khi xác nhận thanh toán.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi xác nhận',
            message: 'Có lỗi xảy ra trong quá trình xác nhận thanh toán.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  const handleRejectBatchPayment = (paymentId: string) => {
    showConfirm({
      title: 'Từ chối ảnh thanh toán đợt này?',
      message: `Bạn có chắc chắn muốn từ chối ảnh chuyển khoản đợt này của đơn #${order.orderNumber}?`,
      confirmText: 'Xác nhận từ chối',
      cancelText: 'Hủy bỏ',
      isDestructive: true,
      onConfirm: async () => {
        setIsProcessingPayment(true);
        try {
          const res = await rejectPayment(order.id, paymentId, 'Hình ảnh thanh toán mờ hoặc không hợp lệ');
          if (res.success) {
            showSuccess({
              title: 'Đã từ chối ảnh',
              message: 'Đã từ chối ảnh thanh toán đợt này.'
            });
          } else {
            showError({
              title: 'Lỗi',
              message: res.error || 'Có lỗi khi từ chối ảnh.'
            });
          }
        } catch {
          showError({
            title: 'Lỗi',
            message: 'Có lỗi xảy ra khi từ chối ảnh.'
          });
        } finally {
          setIsProcessingPayment(false);
        }
      }
    });
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="order-modal-header">
          <div className="modal-header-info">
            <div className="modal-order-number-row">
              <span className="modal-order-badge">#{order.orderNumber}</span>
              <span className={`modal-status-pill status-${order.status.toLowerCase()}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <div className="modal-meta-row">
              <span className="modal-meta-item">
                <Utensils size={13} />
                <strong>{order.tableName}</strong>
              </span>
              <span className="modal-meta-dot">•</span>
              <span className="modal-meta-item">
                <Clock size={13} />
                <span>{dateFormatted} lúc {timeFormatted}</span>
              </span>
            </div>
          </div>

          <button className="modal-close-icon-btn" onClick={onClose} aria-label="Đóng chi tiết">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="order-modal-body">
          {/* Section: Payment Verification Details */}
          <div className="modal-section admin-payment-section">
            <div className="modal-section-title-row">
              <CreditCard size={16} className="modal-section-icon" />
              <h3 className="modal-section-title">THANH TOÁN</h3>
            </div>

            <div className="admin-payment-box">
              <div className="admin-pay-info-grid">
                <div className="admin-pay-item">
                  <span className="admin-pay-label">Phương thức:</span>
                  <strong className="admin-pay-value">
                    {order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
                  </strong>
                </div>

                <div className="admin-pay-item">
                  <span className="admin-pay-label">Trạng thái:</span>
                  <span className={`admin-pay-badge pay-${order.paymentStatus?.toLowerCase() || 'pending'}`}>
                    {order.paymentStatus === 'PAID' && '✓ Đã thanh toán đủ'}
                    {order.paymentStatus === 'VERIFYING' && 'Chờ xác minh ảnh'}
                    {order.paymentStatus === 'PENDING' && (
                      order.paymentMethod === 'BANK_TRANSFER'
                        ? 'Chưa gửi ảnh'
                        : 'Chờ thanh toán tại quầy'
                    )}
                    {order.paymentStatus === 'REJECTED' && '❌ Ảnh không hợp lệ'}
                  </span>
                </div>

                <div className="admin-pay-item">
                  <span className="admin-pay-label">Tổng đơn:</span>
                  <strong className="admin-pay-total">{formatVND(order.total)}</strong>
                </div>

                <div className="admin-pay-item">
                  <span className="admin-pay-label">Đã thanh toán:</span>
                  <strong className="admin-pay-total" style={{ color: '#16a34a' }}>{formatVND(paidAmount)}</strong>
                </div>

                {remainingAmount > 0 && (
                  <div className="admin-pay-item">
                    <span className="admin-pay-label">Còn lại cần thu:</span>
                    <strong className="admin-pay-total" style={{ color: '#dc2626' }}>{formatVND(remainingAmount)}</strong>
                  </div>
                )}
              </div>

              {/* Multi-Payment Batches Section */}
              {order.payments && order.payments.length > 0 ? (
                <div className="admin-payment-batches-container">
                  <h4 className="admin-batches-heading">Lịch sử các đợt thanh toán ({order.payments.length} lượt):</h4>
                  <div className="admin-batches-list">
                    {order.payments.map((p, idx) => {
                      const batchTime = p.createdAt ? new Date(p.createdAt).toLocaleTimeString('vi-VN') : '';
                      return (
                        <div key={p.id || `admin-pay-batch-${idx}`} className="admin-batch-card">
                          <div className="admin-batch-header">
                            <span className="admin-batch-badge">Đợt #{p.batchNumber}</span>
                            <span className="admin-batch-amount">{formatVND(p.amount)}</span>
                            <span className={`admin-pay-badge pay-${p.paymentStatus.toLowerCase()}`}>
                              {p.paymentStatus === 'PAID' && '✓ Đã thanh toán'}
                              {p.paymentStatus === 'VERIFYING' && 'Chờ xác minh'}
                              {p.paymentStatus === 'PENDING' && 'Chờ thanh toán'}
                              {p.paymentStatus === 'REJECTED' && '❌ Từ chối'}
                            </span>
                          </div>

                          <div className="admin-batch-meta">
                            <span>{p.paymentMethod === 'BANK_TRANSFER' ? '💳 Chuyển khoản' : '💵 Tiền mặt'}</span>
                            {batchTime && <span> • {batchTime}</span>}
                            {p.note && <span> • {p.note}</span>}
                          </div>

                          {p.paymentProofPath && (
                            <div className="admin-batch-proof-row">
                              <div
                                className="admin-proof-thumb-card"
                                onClick={() => setZoomProofUrl(p.paymentProofPath || null)}
                                title="Bấm để xem ảnh"
                              >
                                <img src={p.paymentProofPath} alt="Bằng chứng" className="admin-proof-thumb" />
                                <span className="admin-zoom-overlay">
                                  <ZoomIn size={12} />
                                  <span>Xem lớn</span>
                                </span>
                              </div>
                              <span className="admin-proof-tip">Ảnh chuyển khoản đợt #{p.batchNumber}</span>
                            </div>
                          )}

                          {p.paymentStatus !== 'PAID' && (
                            <div className="admin-batch-actions-row">
                              <button
                                className="admin-btn-verify-pay"
                                onClick={() => handleVerifyBatchPayment(p.id, p.amount)}
                                disabled={isProcessingPayment}
                              >
                                <Check size={14} />
                                <span>Xác nhận thu {formatVND(p.amount)}</span>
                              </button>

                              {p.paymentMethod === 'BANK_TRANSFER' && p.paymentProofPath && (
                                <button
                                  className="admin-btn-reject-pay"
                                  onClick={() => handleRejectBatchPayment(p.id)}
                                  disabled={isProcessingPayment}
                                >
                                  <XCircle size={14} />
                                  <span>Từ chối ảnh</span>
                                </button>
                              )}
                            </div>
                          )}

                          {p.paymentStatus === 'PAID' && p.paymentVerifiedAt && (
                            <div className="admin-paid-verified-tag">
                              <CheckCircle2 size={13} />
                              <span>
                                Xác nhận lúc {new Date(p.paymentVerifiedAt).toLocaleTimeString('vi-VN')} ({p.paymentVerifiedBy || 'Admin'})
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* Single payment fallback: Cash payment action */}
                  {order.paymentMethod === 'CASH' && order.paymentStatus !== 'PAID' && (
                    <div className="admin-pay-actions-box">
                      <span className="pay-prompt-text">Khách thanh toán trực tiếp tại quầy:</span>
                      <button
                        className="admin-btn-verify-cash"
                        onClick={handleVerifyPayment}
                        disabled={isProcessingPayment}
                      >
                        <CheckCircle2 size={16} />
                        <span>Xác nhận đã nhận tiền</span>
                      </button>
                    </div>
                  )}

                  {/* Single payment fallback: Bank Transfer */}
                  {order.paymentMethod === 'BANK_TRANSFER' && (
                    <div className="admin-bank-proof-box">
                      {order.paymentProofPath ? (
                        <div className="admin-proof-display-row">
                          <div
                            className="admin-proof-thumb-card"
                            onClick={() => setZoomProofUrl(order.paymentProofPath || null)}
                          >
                            <img
                              src={order.paymentProofPath}
                              alt="Ảnh thanh toán"
                              className="admin-proof-thumb"
                            />
                            <span className="admin-zoom-overlay">
                              <ZoomIn size={14} />
                              <span>Xem lớn</span>
                            </span>
                          </div>

                          <div className="admin-proof-meta">
                            <span className="proof-time-label">
                              Gửi lúc: {order.paymentSubmittedAt ? new Date(order.paymentSubmittedAt).toLocaleTimeString('vi-VN') : 'Mới đây'}
                            </span>
                            <button
                              className="admin-btn-view-large"
                              onClick={() => setZoomProofUrl(order.paymentProofPath || null)}
                            >
                              <Eye size={14} />
                              <span>Xem ảnh lớn</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-no-proof-notice">
                          <span>Khách chưa gửi hình ảnh thanh toán</span>
                        </div>
                      )}

                      {order.paymentStatus !== 'PAID' && (
                        <div className="admin-proof-actions-grid">
                          <button
                            className="admin-btn-verify-pay"
                            onClick={handleVerifyPayment}
                            disabled={isProcessingPayment}
                          >
                            <Check size={16} />
                            <span>Xác nhận thanh toán</span>
                          </button>

                          <button
                            className="admin-btn-reject-pay"
                            onClick={handleRejectPayment}
                            disabled={isProcessingPayment}
                          >
                            <XCircle size={16} />
                            <span>Ảnh không hợp lệ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {order.paymentStatus === 'PAID' && order.paymentVerifiedAt && (
                    <div className="admin-paid-verified-tag">
                      <CheckCircle2 size={15} />
                      <span>
                        Đã xác nhận thanh toán lúc {new Date(order.paymentVerifiedAt).toLocaleTimeString('vi-VN')} ({order.paymentVerifiedBy || 'Admin'})
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Section: Product Items */}
          <div className="modal-section">
            <div className="admin-items-section-header">
              <div className="modal-section-title-row">
                <Receipt size={16} className="modal-section-icon" />
                <h3 className="modal-section-title">ĐƠN ĐẶT ({totalQuantity} món)</h3>
              </div>

              {selectableItems.length > 0 && (
                <label className="admin-select-all-label">
                  <input
                    type="checkbox"
                    checked={isAllSelectableSelected}
                    onChange={handleToggleSelectAll}
                    className="admin-item-checkbox"
                  />
                  <span>Chọn tất cả chưa thanh toán ({selectableItems.length})</span>
                </label>
              )}
            </div>

            {/* Selection Action Floating / Docked Banner */}
            {selectedItemIds.length > 0 && (
              <div className="admin-selection-action-banner">
                <div className="admin-selection-info">
                  <span className="selection-count">Đã chọn <strong>{selectedItemIds.length}</strong> món</span>
                  <span className="selection-divider">•</span>
                  <span className="selection-total">Tổng: <strong>{formatVND(selectedTotal)}</strong></span>
                </div>
                <div className="admin-selection-btns">
                  <button 
                    className="admin-btn-cancel-select"
                    onClick={() => setSelectedItemIds([])}
                    type="button"
                  >
                    Hủy chọn
                  </button>
                  <button 
                    className="admin-btn-confirm-selected"
                    onClick={handleConfirmSelectedPayment}
                    disabled={isProcessingPayment}
                    type="button"
                  >
                    <Check size={15} />
                    <span>Xác nhận thanh toán {formatVND(selectedTotal)}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="modal-items-list">
              {order.items.map((item, idx) => {
                const isItemPaid = item.paymentStatus === 'PAID';
                const isItemVerifying = item.paymentStatus === 'VERIFYING';
                const isItemSelectable = !isItemPaid && !isItemVerifying;
                const isItemSelected = selectedItemIds.includes(item.id);

                // Collect valid options only (no empty or null/undefined)
                const optionsList: string[] = [];
                if (item.selectedSize && item.selectedSize.trim()) {
                  optionsList.push(`Size ${item.selectedSize}`);
                }
                if (item.sugarLevel && item.sugarLevel.trim()) {
                  optionsList.push(`Đường: ${item.sugarLevel}`);
                }
                if (item.iceLevel && item.iceLevel.trim()) {
                  optionsList.push(item.iceLevel === '0%' ? 'Không đá' : `Đá: ${item.iceLevel}`);
                }
                if (item.toppings && Array.isArray(item.toppings) && item.toppings.length > 0) {
                  optionsList.push(`Topping: ${item.toppings.join(', ')}`);
                }

                return (
                  <div
                    key={item.id || idx}
                    className={`modal-item-card ${isItemSelectable ? 'selectable' : ''} ${isItemSelected ? 'selected' : ''} ${isItemPaid ? 'paid' : ''}`}
                    onClick={() => {
                      if (isItemSelectable) {
                        handleToggleItem(item.id);
                      }
                    }}
                  >
                    {isItemSelectable && (
                      <div className="item-checkbox-wrap" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isItemSelected}
                          onChange={() => handleToggleItem(item.id)}
                          className="admin-item-checkbox"
                          aria-label={`Chọn món ${item.productName}`}
                        />
                      </div>
                    )}

                    <img
                      src={item.image || '/coffee_img/1.png'}
                      alt={item.productName}
                      className="modal-item-thumb"
                    />

                    <div className="modal-item-details">
                      <div className="modal-item-top-row">
                        <span className="modal-item-name">{item.productName}</span>
                        <div className="modal-item-right-col">
                          <span className="modal-item-total">{formatVND(item.totalPrice)}</span>
                          {isItemPaid && (
                            <span className="item-pay-badge paid">✓ Đã thanh toán</span>
                          )}
                          {item.revenueRecordedAt && (
                            <span className="item-rev-recorded-badge" title={`Ghi nhận doanh thu lúc ${new Date(item.revenueRecordedAt).toLocaleTimeString('vi-VN')}`}>
                              ✓ Đã ghi nhận doanh thu
                            </span>
                          )}
                          {isItemVerifying && (
                            <span className="item-pay-badge verifying">⏳ Chờ xác minh</span>
                          )}
                          {!isItemPaid && !isItemVerifying && (
                            <span className="item-pay-badge pending">Chưa thanh toán</span>
                          )}
                        </div>
                      </div>

                      <div className="modal-item-meta-row">
                        <span className="modal-item-qty">Số lượng: <strong>×{item.quantity}</strong></span>
                        <span className="modal-item-unit">Đơn giá: {formatVND(item.unitPrice)}</span>
                      </div>

                      {optionsList.length > 0 && (
                        <div className="modal-item-options-box">
                          {optionsList.map((opt, optIdx) => (
                            <span key={optIdx} className="modal-opt-tag">
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Special Notes */}
          {order.note && order.note.trim() && (
            <div className="modal-section">
              <div className="modal-section-title-row">
                <FileText size={16} className="modal-section-icon" />
                <h3 className="modal-section-title">Ghi chú của khách</h3>
              </div>
              <div className="modal-note-box">
                <p>"{order.note}"</p>
              </div>
            </div>
          )}

          {/* Section: Financial Billing Summary */}
          <div className="modal-section">
            <div className="modal-billing-card">
              <div className="billing-row">
                <span className="billing-label">Tạm tính ({totalQuantity} món)</span>
                <span className="billing-value">{formatVND(order.subtotal)}</span>
              </div>

              {order.discount > 0 && (
                <div className="billing-row discount">
                  <span className="billing-label">
                    <Tag size={13} />
                    <span>Giảm giá {order.voucherCode ? `(${order.voucherCode})` : ''}</span>
                  </span>
                  <span className="billing-value discount-text">-{formatVND(order.discount)}</span>
                </div>
              )}

              {order.shippingFee > 0 && (
                <div className="billing-row">
                  <span className="billing-label">Phí dịch vụ</span>
                  <span className="billing-value">{formatVND(order.shippingFee)}</span>
                </div>
              )}

              <div className="billing-divider" />

              <div className="billing-row grand-total">
                <span className="grand-total-label">Tổng cộng</span>
                <span className="grand-total-value">{formatVND(order.total)}</span>
              </div>

              <div className="billing-row" style={{ marginTop: '6px' }}>
                <span className="billing-label" style={{ fontWeight: 600, color: '#15803d' }}>Đã thanh toán</span>
                <span className="billing-value" style={{ fontWeight: 700, color: '#15803d' }}>{formatVND(paidAmount)}</span>
              </div>

              {remainingAmount > 0 ? (
                <>
                  <div className="billing-row" style={{ marginTop: '4px' }}>
                    <span className="billing-label" style={{ fontWeight: 600, color: '#b91c1c' }}>Còn lại cần thu</span>
                    <span className="billing-value" style={{ fontWeight: 700, color: '#b91c1c' }}>{formatVND(remainingAmount)}</span>
                  </div>

                  <div className="admin-pay-all-container">
                    <button
                      className="admin-btn-pay-all-remaining"
                      onClick={handlePayAllRemaining}
                      disabled={isProcessingPayment}
                      type="button"
                    >
                      <CheckCheck size={16} />
                      <span>Thanh toán toàn bộ phần còn lại ({formatVND(remainingAmount)})</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-fully-paid-banner">
                  <CheckCircle2 size={16} />
                  <span>✓ Đơn hàng đã thanh toán đầy đủ</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="order-modal-footer">
          {order.status === 'NEW' && (
            <>
              <button
                className="modal-act-btn cancel"
                onClick={() => {
                  showConfirm({
                    title: 'Hủy đơn hàng?',
                    message: `Bạn có chắc chắn muốn hủy đơn hàng #${order.orderNumber} (${order.tableName})?`,
                    confirmText: 'Xác nhận hủy đơn',
                    cancelText: 'Giữ lại',
                    isDestructive: true,
                    onConfirm: () => {
                      onUpdateStatus(order.id, 'CANCELLED');
                      onClose();
                    }
                  });
                }}
              >
                <XCircle size={16} />
                <span>Hủy đơn</span>
              </button>

              <div className="confirm-btn-wrap">
                <button
                  className={`modal-act-btn confirm ${!isPaid ? 'disabled' : ''}`}
                  disabled={!isPaid}
                  onClick={() => {
                    if (!isPaid) {
                      showWarning({
                        title: 'Chưa xác nhận thanh toán',
                        message: 'Vui lòng xác nhận thanh toán trước khi nhận đơn vào bếp.'
                      });
                      return;
                    }
                    onUpdateStatus(order.id, 'CONFIRMED');
                    onClose();
                  }}
                  title={!isPaid ? 'Vui lòng xác nhận thanh toán trước.' : 'Xác nhận đơn'}
                >
                  <Check size={16} />
                  <span>Xác nhận đơn</span>
                </button>
                {!isPaid && (
                  <span className="unpaid-warning-tip">Vui lòng xác nhận thanh toán trước.</span>
                )}
              </div>
            </>
          )}

          {order.status === 'CONFIRMED' && (
            <>
              <button
                className="modal-act-btn cancel"
                onClick={() => {
                  showConfirm({
                    title: 'Hủy đơn hàng?',
                    message: `Bạn có chắc chắn muốn hủy đơn hàng #${order.orderNumber} (${order.tableName})?`,
                    confirmText: 'Xác nhận hủy đơn',
                    cancelText: 'Giữ lại',
                    isDestructive: true,
                    onConfirm: () => {
                      onUpdateStatus(order.id, 'CANCELLED');
                      onClose();
                    }
                  });
                }}
              >
                <XCircle size={16} />
                <span>Hủy đơn</span>
              </button>
              <button
                className="modal-act-btn prep"
                onClick={() => {
                  onUpdateStatus(order.id, 'PREPARING');
                  onClose();
                }}
              >
                <ChefHat size={16} />
                <span>Bắt đầu chuẩn bị</span>
              </button>
            </>
          )}

          {order.status === 'PREPARING' && (
            <>
              <button
                className="modal-act-btn cancel"
                onClick={() => {
                  onUpdateStatus(order.id, 'CANCELLED');
                  onClose();
                }}
              >
                <XCircle size={16} />
                <span>Hủy đơn</span>
              </button>
              <button
                className="modal-act-btn ready"
                onClick={() => {
                  onUpdateStatus(order.id, 'READY');
                  onClose();
                }}
              >
                <Bell size={16} />
                <span>Đánh dấu sẵn sàng</span>
              </button>
            </>
          )}

          {order.status === 'READY' && (
            <button
              className="modal-act-btn complete"
              onClick={() => {
                onUpdateStatus(order.id, 'COMPLETED');
                onClose();
              }}
            >
              <CheckCheck size={17} />
              <span>Khách đã nhận (Hoàn thành)</span>
            </button>
          )}

          {order.status === 'COMPLETED' && (
            <div className="modal-status-finished-box done">
              <CheckCheck size={18} />
              <span>Đơn hàng đã hoàn thành và phục vụ xong</span>
            </div>
          )}

          {order.status === 'CANCELLED' && (
            <div className="modal-status-finished-box cancelled">
              <XCircle size={18} />
              <span>Đơn hàng này đã bị hủy</span>
            </div>
          )}
        </div>

        {/* Modal Zoom Proof for Admin */}
        {zoomProofUrl && (
          <div className="proof-zoom-modal-backdrop" onClick={() => setZoomProofUrl(null)}>
            <div className="proof-zoom-modal-content" onClick={e => e.stopPropagation()}>
              <div className="proof-zoom-header">
                <h4>Hình ảnh thanh toán của khách</h4>
                <button className="proof-zoom-close" onClick={() => setZoomProofUrl(null)}>
                  <XCircle size={22} />
                </button>
              </div>
              <img src={zoomProofUrl} alt="Hình ảnh chuyển khoản" className="proof-zoom-img" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
