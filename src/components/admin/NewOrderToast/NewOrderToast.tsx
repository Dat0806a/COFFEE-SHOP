import React, { useEffect } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { OrderRecord } from '../../../types';
import './NewOrderToast.css';

interface NewOrderToastProps {
  orders: OrderRecord[];
  onDismiss: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
}

const ToastItem: React.FC<{
  order: OrderRecord;
  totalItems: number;
  timeFormatted: string;
  formattedTotal: string;
  onDismiss: () => void;
  onViewOrder: () => void;
}> = ({ order, totalItems, timeFormatted, formattedTotal, onDismiss, onViewOrder }) => {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="new-order-toast-card">
      <div className="toast-icon-wrap">
        <Bell size={20} className="toast-bell-icon" />
        <span className="toast-pulse-ring"></span>
      </div>

      <div className="toast-content-body">
        <div className="toast-header-line">
          <span className="toast-tag">ĐƠN HÀNG MỚI</span>
          <span className="toast-time">{timeFormatted}</span>
        </div>

        <div className="toast-table-title">{order.tableName} vừa đặt món</div>

        <div className="toast-details-line">
          <span>{totalItems} món</span>
          <span className="toast-dot">•</span>
          <span className="toast-price">{formattedTotal}</span>
          <span className="toast-dot">•</span>
          <span className="toast-code">#{order.orderNumber}</span>
        </div>
      </div>

      <div className="toast-actions">
        <button
          className="toast-view-btn"
          onClick={onViewOrder}
        >
          <span>Xem đơn</span>
          <ArrowRight size={14} />
        </button>

        <button className="toast-close-btn" onClick={onDismiss} aria-label="Đóng thông báo">
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export const NewOrderToast: React.FC<NewOrderToastProps> = ({
  orders,
  onDismiss,
  onViewOrder
}) => {
  if (!orders || orders.length === 0) return null;

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="new-order-toast-container">
      {orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const timeFormatted = new Date(order.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <ToastItem
            key={order.id}
            order={order}
            totalItems={totalItems}
            timeFormatted={timeFormatted}
            formattedTotal={formatVND(order.total)}
            onDismiss={() => onDismiss(order.id)}
            onViewOrder={() => onViewOrder(order.id)}
          />
        );
      })}
    </div>
  );
};

