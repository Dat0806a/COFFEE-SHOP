import React, { useEffect } from 'react';
import { Bell, CheckCircle2, ChefHat, CheckCheck, XCircle, X, ArrowRight } from 'lucide-react';
import { CustomerToastItem } from '../../../context/StoreContext';
import { useTableSession } from '../../../context/TableSessionContext';
import './CustomerToast.css';

interface CustomerToastProps {
  toasts: CustomerToastItem[];
  onDismiss: (toastId: string) => void;
  onViewOrder: (orderId: string) => void;
}

const SingleToast: React.FC<{
  toast: CustomerToastItem;
  onDismiss: () => void;
  onViewOrder: () => void;
}> = ({ toast, onDismiss, onViewOrder }) => {
  useEffect(() => {
    const duration = toast.status === 'READY' ? 15000 : 6000;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.status]);

  const getIcon = () => {
    switch (toast.status) {
      case 'CONFIRMED':
        return <CheckCircle2 size={18} className="c-toast-icon icon-confirmed" />;
      case 'PREPARING':
        return <ChefHat size={18} className="c-toast-icon icon-prep" />;
      case 'READY':
        return <Bell size={18} className="c-toast-icon icon-ready" />;
      case 'COMPLETED':
        return <CheckCheck size={18} className="c-toast-icon icon-completed" />;
      case 'CANCELLED':
        return <XCircle size={18} className="c-toast-icon icon-cancelled" />;
      default:
        return <Bell size={18} className="c-toast-icon" />;
    }
  };

  const getStatusBadge = () => {
    switch (toast.status) {
      case 'CONFIRMED':
        return 'QUÁN ĐÃ NHẬN ĐƠN';
      case 'PREPARING':
        return 'ĐANG LÀM MÓN';
      case 'READY':
        return 'SẴN SÀNG PHỤC VỤ';
      case 'COMPLETED':
        return 'ĐÃ HOÀN THÀNH';
      case 'CANCELLED':
        return 'ĐÃ HỦY ĐƠN';
      default:
        return 'CẬP NHẬT ĐƠN HÀNG';
    }
  };

  return (
    <div className={`customer-toast-item status-${toast.status.toLowerCase()}`}>
      <div className="c-toast-icon-wrap">
        {getIcon()}
      </div>

      <div className="c-toast-body" onClick={onViewOrder} role="button" tabIndex={0}>
        <div className="c-toast-tag">{getStatusBadge()}</div>
        <div className="c-toast-msg">{toast.message}</div>
        <div className="c-toast-view-hint">
          <span>Xem tiến trình</span>
          <ArrowRight size={12} />
        </div>
      </div>

      <button className="c-toast-close" onClick={onDismiss} aria-label="Đóng thông báo">
        <X size={14} />
      </button>
    </div>
  );
};

export const CustomerToast: React.FC<CustomerToastProps> = ({
  toasts,
  onDismiss,
  onViewOrder
}) => {
  const { currentTable, sessionOrderIds } = useTableSession();
  const currentTableNumber = currentTable?.tableNumber || 1;

  // Only show toasts for orders belonging to this table in the current session
  const tableToasts = toasts.filter(
    t => t.tableNumber === currentTableNumber && sessionOrderIds.includes(t.orderId)
  );

  if (tableToasts.length === 0) return null;

  return (
    <div className="customer-toast-container">
      {tableToasts.map(toast => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onViewOrder={() => onViewOrder(toast.orderId)}
        />
      ))}
    </div>
  );
};
