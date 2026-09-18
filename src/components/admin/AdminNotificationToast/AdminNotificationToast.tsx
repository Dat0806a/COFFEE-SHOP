import React, { useEffect } from 'react';
import {
  Bell,
  PlusCircle,
  Edit3,
  Trash2,
  CreditCard,
  XCircle,
  X,
  ArrowRight
} from 'lucide-react';
import { AdminNotification, AdminNotificationEventType } from '../../../types';
import { soundService } from '../../../services/soundService';
import './AdminNotificationToast.css';

interface AdminNotificationToastProps {
  notifications: AdminNotification[];
  onDismiss: (id: string) => void;
  onViewOrder: (orderIdOrNumber: string) => void;
}

const getEventConfig = (type: AdminNotificationEventType) => {
  switch (type) {
    case 'ORDER_CREATED':
      return {
        label: 'ĐƠN HÀNG MỚI',
        icon: <Bell size={18} />,
        accentClass: 'toast-created'
      };
    case 'ITEMS_ADDED':
      return {
        label: 'KHÁCH GỌI THÊM MÓN',
        icon: <PlusCircle size={18} />,
        accentClass: 'toast-added'
      };
    case 'ORDER_UPDATED':
      return {
        label: 'CHỈNH SỬA ĐƠN HÀNG',
        icon: <Edit3 size={18} />,
        accentClass: 'toast-updated'
      };
    case 'ITEM_REMOVED':
      return {
        label: 'ĐÃ XÓA MÓN',
        icon: <Trash2 size={18} />,
        accentClass: 'toast-removed'
      };
    case 'PAYMENT_PROOF_SUBMITTED':
      return {
        label: 'KHÁCH GỬI THANH TOÁN',
        icon: <CreditCard size={18} />,
        accentClass: 'toast-payment'
      };
    case 'PAYMENT_PROOF_RESUBMITTED':
      return {
        label: 'GỬI LẠI ẢNH THANH TOÁN',
        icon: <CreditCard size={18} />,
        accentClass: 'toast-payment'
      };
    case 'ORDER_CANCELLED':
      return {
        label: 'ĐƠN HÀNG ĐÃ HỦY',
        icon: <XCircle size={18} />,
        accentClass: 'toast-cancelled'
      };
    case 'ADDITIONAL_ORDER_CREATED':
      return {
        label: 'ĐƠN GỌI THÊM MỚI',
        icon: <Bell size={18} />,
        accentClass: 'toast-additional'
      };
    default:
      return {
        label: 'THÔNG BÁO MỚI',
        icon: <Bell size={18} />,
        accentClass: 'toast-created'
      };
  }
};

const ToastItem: React.FC<{
  notification: AdminNotification;
  onDismiss: () => void;
  onViewOrder: () => void;
}> = ({ notification, onDismiss, onViewOrder }) => {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const config = getEventConfig(notification.eventType);
  const timeFormatted = new Date(notification.createdAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`admin-notif-toast-card ${config.accentClass}`}>
      <div className="toast-icon-wrap">
        {config.icon}
        <span className="toast-pulse-ring"></span>
      </div>

      <div className="toast-content-body">
        <div className="toast-header-line">
          <span className="toast-tag">{config.label}</span>
          <span className="toast-time">{timeFormatted}</span>
        </div>

        <div className="toast-order-ref">
          <span className="toast-order-code">#{notification.orderNumber}</span>
          <span className="toast-dot">•</span>
          <span className="toast-table-name">{notification.tableName}</span>
        </div>

        <div className="toast-message-text">{notification.message}</div>
      </div>

      <div className="toast-actions">
        <button
          className="toast-view-btn"
          onClick={() => {
            soundService.stopSound();
            onViewOrder();
            onDismiss();
          }}
        >
          <span>Xem đơn</span>
          <ArrowRight size={14} />
        </button>

        <button
          className="toast-close-btn"
          onClick={() => {
            soundService.stopSound();
            onDismiss();
          }}
          aria-label="Đóng thông báo"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export const AdminNotificationToast: React.FC<AdminNotificationToastProps> = ({
  notifications,
  onDismiss,
  onViewOrder
}) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="admin-notif-toast-container">
      {notifications.map(notif => (
        <ToastItem
          key={notif.id}
          notification={notif}
          onDismiss={() => onDismiss(notif.id)}
          onViewOrder={() => onViewOrder(notif.orderId || notif.orderNumber)}
        />
      ))}
    </div>
  );
};
