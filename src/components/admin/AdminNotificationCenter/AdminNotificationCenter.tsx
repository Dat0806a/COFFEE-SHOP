import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  ArrowRight,
  PlusCircle,
  Edit3,
  Trash2,
  CreditCard,
  XCircle,
  Clock
} from 'lucide-react';
import { AdminNotification, AdminNotificationEventType } from '../../../types';
import './AdminNotificationCenter.css';

interface AdminNotificationCenterProps {
  notifications: AdminNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewOrder: (orderIdOrNumber: string) => void;
}

const getEventBadge = (type: AdminNotificationEventType) => {
  switch (type) {
    case 'ORDER_CREATED':
      return {
        label: 'Đơn mới',
        icon: <Bell size={14} />,
        className: 'badge-created'
      };
    case 'ITEMS_ADDED':
      return {
        label: 'Gọi thêm món',
        icon: <PlusCircle size={14} />,
        className: 'badge-added'
      };
    case 'ORDER_UPDATED':
      return {
        label: 'Chỉnh sửa đơn',
        icon: <Edit3 size={14} />,
        className: 'badge-updated'
      };
    case 'ITEM_REMOVED':
      return {
        label: 'Xóa món',
        icon: <Trash2 size={14} />,
        className: 'badge-removed'
      };
    case 'PAYMENT_PROOF_SUBMITTED':
      return {
        label: 'Thanh toán',
        icon: <CreditCard size={14} />,
        className: 'badge-payment'
      };
    case 'PAYMENT_PROOF_RESUBMITTED':
      return {
        label: 'Gửi lại ảnh',
        icon: <CreditCard size={14} />,
        className: 'badge-payment'
      };
    case 'ORDER_CANCELLED':
      return {
        label: 'Hủy đơn',
        icon: <XCircle size={14} />,
        className: 'badge-cancelled'
      };
    case 'ADDITIONAL_ORDER_CREATED':
      return {
        label: 'Đơn thêm mới',
        icon: <Bell size={14} />,
        className: 'badge-additional'
      };
    default:
      return {
        label: 'Thông báo',
        icon: <Bell size={14} />,
        className: 'badge-created'
      };
  }
};

const formatTimeAgo = (isoString: string): string => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return new Date(isoString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
};

export const AdminNotificationCenter: React.FC<AdminNotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewOrder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredList = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const handleItemClick = (notif: AdminNotification) => {
    if (!notif.isRead) {
      onMarkAsRead(notif.id);
    }
    onViewOrder(notif.orderId || notif.orderNumber);
    setIsOpen(false);
  };

  return (
    <div className="admin-notif-center-wrapper">
      {/* Trigger Bell Button */}
      <button
        ref={triggerRef}
        className={`admin-bell-btn ${unreadCount > 0 ? 'has-unread' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Trung tâm Thông báo"
        aria-label="Trung tâm Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="bell-badge-pill">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div ref={panelRef} className="admin-notif-panel">
          {/* Header */}
          <div className="notif-panel-header">
            <div className="notif-header-title-box">
              <h3 className="notif-panel-title">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="notif-unread-count-tag">{unreadCount} mới</span>
              )}
            </div>

            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  className="notif-mark-all-btn"
                  onClick={onMarkAllAsRead}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={14} />
                  <span>Đã đọc tất cả</span>
                </button>
              )}

              <button
                className="notif-panel-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="notif-filter-bar">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Body List */}
          <div className="notif-panel-body">
            {filteredList.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon-wrap">
                  <Bell size={28} />
                </div>
                <p className="notif-empty-title">
                  {filter === 'unread'
                    ? 'Bạn đã đọc hết mọi thông báo!'
                    : 'Chưa có thông báo nào từ khách hàng'}
                </p>
                <p className="notif-empty-subtitle">
                  Khi khách đặt món, gọi thêm, chỉnh sửa hoặc gửi thanh toán, thông báo sẽ xuất hiện ngay tại đây.
                </p>
              </div>
            ) : (
              <div className="notif-items-list">
                {filteredList.map(notif => {
                  const badge = getEventBadge(notif.eventType);
                  const timeFormatted = new Date(notif.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={notif.id}
                      className={`notif-card-item ${!notif.isRead ? 'unread' : ''}`}
                      onClick={() => handleItemClick(notif)}
                    >
                      <div className={`notif-card-badge ${badge.className}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </div>

                      <div className="notif-card-meta">
                        <span className="notif-order-code">#{notif.orderNumber}</span>
                        <span className="notif-meta-dot">•</span>
                        <span className="notif-table-name">{notif.tableName}</span>
                        <span className="notif-meta-dot">•</span>
                        <span className="notif-time-ago" title={timeFormatted}>
                          <Clock size={11} className="time-icon" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                        {!notif.isRead && <span className="notif-unread-dot" />}
                      </div>

                      <div className="notif-card-msg">{notif.message}</div>

                      <div className="notif-card-footer">
                        <button
                          className="notif-card-view-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(notif);
                          }}
                        >
                          <span>Xem chi tiết đơn</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
