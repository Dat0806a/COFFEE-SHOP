import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Utensils,
  Receipt,
  FileText,
  Edit3,
  Trash2,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Bell,
  CheckCheck,
  XCircle,
  AlertCircle,
  CreditCard,
  Banknote,
  Camera
} from 'lucide-react';
import { OrderRecord, getOrderPaidAmount, getOrderRemainingAmount } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { useCart } from '../../../context/CartContext';
import { useDialog } from '../../../context/DialogContext';
import './CustomerOrderDetailModal.css';

interface CustomerOrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
  onNavigateToMenu: () => void;
  onStartEditOrder: (order: OrderRecord) => void;
}

export const CustomerOrderDetailModal: React.FC<CustomerOrderDetailModalProps> = ({
  orderId,
  onClose,
  onNavigateToMenu,
  onStartEditOrder
}) => {
  const { orders, cancelCustomerOrder, fetchOrderById, uploadPaymentProof } = useStore();
  const { clearCart } = useCart();
  const { showError, showWarning, showSuccess, showConfirm } = useDialog();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);
  const [isReuploading, setIsReuploading] = useState(false);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadPreview, setReuploadPreview] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrderById(orderId);
    }
  }, [orderId, fetchOrderById]);

  useEffect(() => {
    if (orderId && orders.length > 0 && !orders.some(o => o.id === orderId)) {
      onClose();
    }
  }, [orderId, orders, onClose]);

  if (!orderId) return null;

  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const createdAtDate = new Date(order.createdAt);
  const timeFormatted = `${createdAtDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  })} • ${createdAtDate.toLocaleDateString('vi-VN')}`;

  // Progress Stepper Mapping
  let statusTitle = 'Đang xử lý';
  let statusSubtitle = 'Quán đã tiếp nhận thông tin đơn của bạn.';
  let statusStep = 1;

  if (order.status === 'CONFIRMED') {
    statusStep = 2;
    statusTitle = 'Quán đã nhận đơn';
    statusSubtitle = 'Đơn hàng đã được xác nhận và chuyển tới quầy pha chế.';
  } else if (order.status === 'PREPARING') {
    statusStep = 3;
    statusTitle = 'Đang pha chế';
    statusSubtitle = 'Barista đang chuẩn bị đồ uống tươi ngon cho bạn.';
  } else if (order.status === 'COMPLETED') {
    statusStep = 4;
    statusTitle = 'Đã hoàn thành';
    statusSubtitle = 'Đồ uống đã được phục vụ tại bàn. Chúc bạn ngon miệng!';
  } else if (order.status === 'CANCELLED') {
    statusStep = 0;
    statusTitle = 'Đơn hàng đã bị hủy';
    statusSubtitle = 'Đơn hàng này đã được hủy bỏ.';
  }

  const handleCancelOrder = () => {
    showConfirm({
      title: 'Hủy đơn hàng?',
      message: `Bạn có chắc chắn muốn hủy đơn hàng #${order.orderNumber}? Mọi món ăn trong đơn sẽ bị hủy.`,
      confirmText: 'Xác nhận hủy đơn',
      cancelText: 'Không, giữ lại',
      isDestructive: true,
      onConfirm: async () => {
        setIsCancelling(true);
        setCancelError(null);
        const res = await cancelCustomerOrder(order.id);
        setIsCancelling(false);
        if (!res.success) {
          const errMsg = res.error || 'Quán đã tiếp nhận đơn hàng nên không thể hủy vào lúc này.';
          setCancelError(errMsg);
          showError({
            title: 'Không thể hủy đơn',
            message: errMsg
          });
        } else {
          showSuccess({
            title: 'Đã hủy đơn hàng',
            message: `Đơn hàng #${order.orderNumber} đã được hủy thành công.`
          });
        }
      }
    });
  };

  const handleEditClick = () => {
    if (order.status !== 'NEW') {
      showWarning({
        title: 'Không thể chỉnh sửa',
        message: 'Đơn hàng đã được quán xác nhận nên không thể chỉnh sửa.'
      });
      return;
    }
    onStartEditOrder(order);
    onClose();
  };

  const handleContinueOrderClick = () => {
    clearCart();
    onClose();
    onNavigateToMenu();
  };

  return (
    <div className="c-modal-overlay" onClick={onClose}>
      <div className="c-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="c-modal-header">
          <div className="c-modal-title-group">
            <span className="c-modal-badge">CHI TIẾT ĐƠN HÀNG</span>
            <h3 className="c-modal-order-number">#{order.orderNumber}</h3>
          </div>
          <button className="c-modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="c-modal-body">
          {/* Status Tracker Banner */}
          <div className={`c-status-banner status-${order.status.toLowerCase()}`}>
            <div className="c-status-icon-wrap">
              {order.status === 'NEW' && <Clock size={32} className="c-status-spin" />}
              {order.status === 'CONFIRMED' && <CheckCircle2 size={32} />}
              {order.status === 'PREPARING' && <ChefHat size={32} />}
              {order.status === 'READY' && <Bell size={32} className="c-status-ring" />}
              {order.status === 'COMPLETED' && <CheckCheck size={32} />}
              {order.status === 'CANCELLED' && <XCircle size={32} />}
            </div>

            <h4 className="c-status-title">{statusTitle}</h4>
            <p className="c-status-desc">{statusSubtitle}</p>

            {/* Stepper Progress */}
            {order.status !== 'CANCELLED' && (
              <div className="c-stepper-container">
                <div className={`c-step-node ${statusStep >= 1 ? 'active' : ''} ${statusStep > 1 ? 'done' : ''}`}>
                  <div className="c-step-circle">{statusStep > 1 ? '✓' : '●'}</div>
                  <span className="c-step-label">Đã gửi</span>
                </div>
                <div className={`c-step-line ${statusStep >= 2 ? 'active' : ''}`} />
                <div className={`c-step-node ${statusStep >= 2 ? 'active' : ''} ${statusStep > 2 ? 'done' : ''}`}>
                  <div className="c-step-circle">{statusStep > 2 ? '✓' : statusStep === 2 ? '●' : '○'}</div>
                  <span className="c-step-label">Nhận đơn</span>
                </div>
                <div className={`c-step-line ${statusStep >= 3 ? 'active' : ''}`} />
                <div className={`c-step-node ${statusStep >= 3 ? 'active' : ''} ${statusStep > 3 ? 'done' : ''}`}>
                  <div className="c-step-circle">{statusStep > 3 ? '✓' : statusStep === 3 ? '●' : '○'}</div>
                  <span className="c-step-label">Làm món</span>
                </div>
                <div className={`c-step-line ${statusStep >= 4 ? 'active' : ''}`} />
                <div className={`c-step-node ${statusStep >= 4 ? 'active' : ''} ${statusStep >= 5 ? 'done' : ''}`}>
                  <div className="c-step-circle">{statusStep >= 5 ? '✓' : statusStep === 4 ? '●' : '○'}</div>
                  <span className="c-step-label">Sẵn sàng</span>
                </div>
              </div>
            )}
          </div>

          {/* Status notices & lock notifications */}
          {order.status === 'CONFIRMED' && (
            <div className="c-order-notice-box notice-lock">
              <span>🔒 Quán đã nhận đơn. Đơn hàng đã được khóa và không thể chỉnh sửa.</span>
            </div>
          )}

          {order.status === 'PREPARING' && (
            <div className="c-order-notice-box notice-prep">
              <span>🧑‍🍳 Quán đang chuẩn bị món cho bàn của bạn.</span>
            </div>
          )}

          {order.status === 'READY' && (
            <div className="c-order-notice-box notice-ready">
              <span>🎉 Món đã sẵn sàng phục vụ! Nhân viên đang mang ra bàn.</span>
            </div>
          )}

          {order.status === 'COMPLETED' && (
            <div className="c-order-notice-box notice-done">
              <span>✨ Bạn đã nhận món. Cảm ơn bạn đã thưởng thức tại ANA Chiang Mai!</span>
            </div>
          )}

          {cancelError && (
            <div className="c-order-notice-box notice-error">
              <AlertCircle size={16} />
              <span>{cancelError}</span>
            </div>
          )}

          {/* Order Info Row */}
          <div className="c-meta-card">
            <div className="c-meta-item">
              <div className="c-meta-label-box">
                <Clock size={14} className="c-meta-icon" />
                <span>Thời gian:</span>
              </div>
              <strong className="c-meta-value">{timeFormatted}</strong>
            </div>

            <div className="c-meta-item">
              <div className="c-meta-label-box">
                <Utensils size={14} className="c-meta-icon" />
                <span>Bàn phục vụ:</span>
              </div>
              <strong className="c-meta-value highlight-table">{order.tableName}</strong>
            </div>

            {order.note && (
              <div className="c-meta-item note-item">
                <div className="c-meta-label-box">
                  <FileText size={14} className="c-meta-icon" />
                  <span>Ghi chú:</span>
                </div>
                <span className="c-meta-note">"{order.note}"</span>
              </div>
            )}
          </div>

          {/* Payment Status Section */}
          <div className="c-payment-section">
            <div className="c-items-header">
              <CreditCard size={16} className="c-items-icon" />
              <span>THANH TOÁN</span>
            </div>

            <div className="c-payment-content">
              <div className="c-pay-row">
                <span className="c-pay-label">Phương thức:</span>
                <strong className="c-pay-value">
                  {order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
                </strong>
              </div>

              <div className="c-pay-row">
                <span className="c-pay-label">Trạng thái:</span>
                <span className={`c-pay-badge pay-${order.paymentStatus?.toLowerCase() || 'pending'}`}>
                  {order.paymentStatus === 'PAID' && '✓ Đã thanh toán'}
                  {order.paymentStatus === 'VERIFYING' && 'Quán đang xác minh'}
                  {order.paymentStatus === 'PENDING' && (
                    order.paymentMethod === 'BANK_TRANSFER'
                      ? 'Chưa gửi hình ảnh thanh toán'
                      : 'Chờ thanh toán tại quầy'
                  )}
                  {order.paymentStatus === 'REJECTED' && '❌ Ảnh không hợp lệ'}
                </span>
              </div>

              {/* Cash Pending Note */}
              {order.paymentMethod === 'CASH' && order.paymentStatus === 'PENDING' && (
                <div className="c-pay-notice-box cash">
                  <Banknote size={16} />
                  <span>Vui lòng ra quầy trả tiền để xác nhận đơn ({(order.total * 1000).toLocaleString('vi-VN')}đ)</span>
                </div>
              )}

              {/* Bank Transfer Verifying Note & Proof */}
              {order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'VERIFYING' && (
                <div className="c-pay-notice-box verifying">
                  <Clock size={16} />
                  <div className="c-verifying-text">
                    <strong>Đã gửi hình ảnh thanh toán</strong>
                    <span>Quán đang kiểm tra giao dịch của bạn.</span>
                  </div>
                  {order.paymentProofPath && (
                    <div
                      className="c-proof-thumb-box"
                      onClick={() => setZoomProofUrl(order.paymentProofPath || null)}
                      title="Bấm để xem ảnh lớn"
                    >
                      <img src={order.paymentProofPath} alt="Ảnh thanh toán" className="c-proof-thumb" />
                      <span className="c-zoom-tag">🔍 Xem ảnh</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bank Transfer Rejected Note & Re-upload */}
              {order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'REJECTED' && (
                <div className="c-pay-notice-box rejected">
                  <AlertCircle size={16} />
                  <div className="c-rejected-text">
                    <strong>Ảnh thanh toán chưa được xác nhận. Vui lòng gửi lại.</strong>
                    {order.paymentRejectionReason && (
                      <span className="c-reject-reason">Lý do: {order.paymentRejectionReason}</span>
                    )}

                    <div className="c-reupload-actions">
                      <label htmlFor={`c-reupload-input-${order.id}`} className="c-reupload-pick-btn">
                        <Camera size={14} />
                        <span>{reuploadFile ? 'Đã chọn ảnh mới' : 'Chọn ảnh mới'}</span>
                      </label>
                      <input
                        id={`c-reupload-input-${order.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setReuploadFile(file);
                            setReuploadPreview(URL.createObjectURL(file));
                          }
                        }}
                      />

                      {reuploadPreview && (
                        <div className="c-reupload-preview-row">
                          <img src={reuploadPreview} alt="Preview" className="c-reupload-preview-img" />
                          <button
                            className="c-reupload-submit-btn"
                            disabled={isReuploading}
                            onClick={async () => {
                              if (!reuploadFile) return;
                              setIsReuploading(true);
                              try {
                                const res = await uploadPaymentProof(order.id, reuploadFile);
                                if (res.success) {
                                  showSuccess({
                                    title: 'Gửi ảnh thành công',
                                    message: 'Đã gửi lại ảnh thanh toán thành công! Quán đang kiểm tra lại giao dịch.'
                                  });
                                  setReuploadFile(null);
                                  setReuploadPreview(null);
                                } else {
                                  showError({
                                    title: 'Tải ảnh thất bại',
                                    message: res.error || 'Có lỗi khi tải ảnh lên. Vui lòng thử lại.'
                                  });
                                }
                              } catch {
                                showError({
                                  title: 'Lỗi tải ảnh',
                                  message: 'Có lỗi xảy ra khi gửi ảnh thanh toán. Vui lòng thử lại.'
                                });
                              } finally {
                                setIsReuploading(false);
                              }
                            }}
                          >
                            {isReuploading ? 'Đang gửi...' : 'Gửi lại'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Paid Status Banner */}
              {order.paymentStatus === 'PAID' && (
                <div className="c-pay-notice-box paid">
                  <CheckCircle2 size={16} />
                  <span>✓ Thanh toán đã được xác nhận</span>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="c-items-section">
            <div className="c-items-header">
              <Receipt size={16} className="c-items-icon" />
              <span>ĐƠN ĐẶT ({totalItemsCount} món)</span>
            </div>

            <div className="c-items-list">
              {order.items.map((item, idx) => {
                const isItemPaid = item.paymentStatus === 'PAID';
                const isItemVerifying = item.paymentStatus === 'VERIFYING';

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
                  <div key={item.id || `modal-item-${idx}`} className="c-item-row">
                    <img
                      src={item.image || '/coffee_img/1.png'}
                      alt={item.productName}
                      className="c-item-img"
                    />
                    <div className="c-item-details">
                      <div className="c-item-main-row">
                        <span className="c-item-name">{item.productName}</span>
                        <div className="c-item-price-col">
                          <span className="c-item-price">{item.totalPrice}K</span>
                          {isItemPaid && (
                            <span className="c-item-pay-badge paid">✓ Đã thanh toán</span>
                          )}
                          {isItemVerifying && (
                            <span className="c-item-pay-badge verifying">⏳ Đang xác minh</span>
                          )}
                          {!isItemPaid && !isItemVerifying && (
                            <span className="c-item-pay-badge pending">Chờ thanh toán</span>
                          )}
                        </div>
                      </div>
                      <div className="c-item-sub-row">
                        {optionsSummary ? (
                          <span className="c-item-opts">{optionsSummary}</span>
                        ) : (
                          <span className="c-item-opts">Tiêu chuẩn</span>
                        )}
                        <span className="c-item-qty">x{item.quantity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing Card */}
          <div className="c-billing-card">
            <div className="c-billing-row">
              <span>Tạm tính</span>
              <span>{order.subtotal}K</span>
            </div>

            {order.discount > 0 && (
              <div className="c-billing-row discount">
                <span>Ưu đãi {order.voucherCode ? `(${order.voucherCode})` : ''}</span>
                <span className="discount-val">-{order.discount}K</span>
              </div>
            )}

            {order.shippingFee > 0 && (
              <div className="c-billing-row">
                <span>Phí phục vụ</span>
                <span>{order.shippingFee}K</span>
              </div>
            )}

            <div className="c-billing-divider" />

            <div className="c-billing-row total">
              <span className="c-total-label">Tổng đơn hàng</span>
              <span className="c-total-value">{order.total}K</span>
            </div>

            <div className="c-billing-row paid-row">
              <span className="c-paid-label">Đã thanh toán</span>
              <span className="c-paid-value text-success font-semibold">{getOrderPaidAmount(order)}K</span>
            </div>

            {getOrderRemainingAmount(order) > 0 && (
              <div className="c-billing-row remaining-row">
                <span className="c-remaining-label">Còn lại cần trả</span>
                <span className="c-remaining-value text-danger font-semibold">{getOrderRemainingAmount(order)}K</span>
              </div>
            )}
          </div>

          {/* Payment History Section */}
          {order.payments && order.payments.length > 0 && (
            <div className="c-payments-history-section">
              <div className="c-items-header">
                <CreditCard size={16} className="c-items-icon" />
                <span>LỊCH SỬ THANH TOÁN ({order.payments.length} lượt)</span>
              </div>
              <div className="c-payments-list">
                {order.payments.map((pay, pIdx) => {
                  const payTime = pay.createdAt
                    ? new Date(pay.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <div key={pay.id || `c-pay-${pIdx}`} className="c-payment-row">
                      <div className="c-pay-main">
                        <div className="c-pay-batch-info">
                          <span className="c-pay-batch-badge">Đợt #{pay.batchNumber}</span>
                          <span className="c-pay-method-text">
                            {pay.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
                            {payTime ? ` • ${payTime}` : ''}
                          </span>
                        </div>
                        <span className="c-pay-amount">{pay.amount}K</span>
                      </div>
                      <div className="c-pay-sub">
                        <span className={`c-pay-status-pill status-${pay.paymentStatus.toLowerCase()}`}>
                          {pay.paymentStatus === 'PAID' && '✓ Đã thanh toán'}
                          {pay.paymentStatus === 'VERIFYING' && '⏳ Chờ xác nhận ảnh'}
                          {pay.paymentStatus === 'PENDING' && 'Chờ thanh toán'}
                          {pay.paymentStatus === 'REJECTED' && '❌ Bị từ chối'}
                        </span>
                        {pay.paymentProofPath && (
                          <button
                            type="button"
                            className="c-pay-view-proof-btn"
                            onClick={() => setZoomProofUrl(pay.paymentProofPath || null)}
                          >
                            🔍 Xem ảnh
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="c-modal-footer">
          {/* If NEW and not locked by payment: Show Edit & Cancel buttons */}
          {order.status === 'NEW' &&
           order.paymentStatus !== 'PAID' &&
           !(order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'VERIFYING') && (
            <div className="c-new-actions-grid">
              <button
                className="c-edit-order-btn"
                onClick={handleEditClick}
                title="Chỉnh sửa món trong đơn hàng"
              >
                <Edit3 size={15} />
                <span>Chỉnh sửa đơn</span>
              </button>

              <button
                className="c-cancel-order-btn"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                title="Hủy đơn hàng"
              >
                <Trash2 size={15} />
                <span>{isCancelling ? 'Đang hủy...' : 'Hủy đơn'}</span>
              </button>
            </div>
          )}

          {order.status === 'COMPLETED' ? (
            <div className="c-order-notice-box notice-lock">
              <span>✓ Đơn hàng đã hoàn thành. Quý khách có thể bấm "Đặt đơn mới" để gọi món tiếp theo cho bàn.</span>
            </div>
          ) : order.paymentStatus === 'PAID' ? (
            <div className="c-order-notice-box notice-lock">
              <span>✓ Đơn hàng đã được thanh toán đủ. Bấm "Tiếp tục gọi thêm món" để đặt thêm đơn mới cho bàn.</span>
            </div>
          ) : null}

          {order.status === 'NEW' && order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus === 'VERIFYING' && (
            <div className="c-order-notice-box notice-lock">
              <span>🔒 Đơn đang chờ xác minh thanh toán, tạm thời không thể chỉnh sửa.</span>
            </div>
          )}

          {/* Always have "Tiếp tục gọi món" button */}
          <button
            className="c-continue-menu-btn"
            onClick={handleContinueOrderClick}
          >
            <span>{order.status === 'COMPLETED' || order.status === 'CANCELLED' ? 'Đặt đơn mới' : 'Tiếp tục gọi thêm món'}</span>
            <ArrowRight size={16} />
          </button>
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
    </div>
  );
};
