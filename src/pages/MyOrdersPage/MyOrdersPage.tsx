import React, { useState } from 'react';
import {
  ShoppingBag,
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Bell,
  CheckCheck,
  XCircle,
  Receipt,
  Edit3
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useTableSession } from '../../context/TableSessionContext';
import { OrderRecord, OrderStatus, getOrderActivityTimestamp } from '../../types';
import './MyOrdersPage.css';

interface MyOrdersPageProps {
  onExploreMenu: () => void;
  onOpenOrderDetail: (orderId: string) => void;
  onStartEditOrder: (order: OrderRecord) => void;
  onBack?: () => void;
}

type TabFilter = 'ACTIVE' | 'COMPLETED' | 'ALL';

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({
  onExploreMenu,
  onOpenOrderDetail,
  onStartEditOrder,
  onBack
}) => {
  const { currentTable, sessionOrderIds } = useTableSession();
  const { orders } = useStore();
  const [filterTab, setFilterTab] = useState<TabFilter>('ACTIVE');

  const tableNumber = currentTable?.tableNumber || 1;
  // User ONLY sees orders placed within the current active table session, sorted latest active first
  const tableOrders = orders
    .filter(o => o.tableNumber === tableNumber && sessionOrderIds.includes(o.id))
    .sort((a, b) => getOrderActivityTimestamp(b) - getOrderActivityTimestamp(a));

  const activeOrders = tableOrders.filter(
    o => o.status === 'NEW' || o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY'
  );

  const completedOrders = tableOrders.filter(
    o => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  );

  const filteredOrders = filterTab === 'ACTIVE'
    ? activeOrders
    : filterTab === 'COMPLETED'
    ? completedOrders
    : tableOrders;

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  const getStatusInfo = (status: OrderStatus) => {
    switch (status) {
      case 'NEW':
        return { label: 'Đã gửi', className: 'status-new', icon: <Clock size={14} /> };
      case 'CONFIRMED':
        return { label: 'Quán đã nhận', className: 'status-confirmed', icon: <CheckCircle2 size={14} /> };
      case 'PREPARING':
        return { label: 'Đang làm món', className: 'status-preparing', icon: <ChefHat size={14} /> };
      case 'READY':
        return { label: 'Sẵn sàng phục vụ', className: 'status-ready', icon: <Bell size={14} /> };
      case 'COMPLETED':
        return { label: 'Hoàn thành', className: 'status-completed', icon: <CheckCheck size={14} /> };
      case 'CANCELLED':
        return { label: 'Đã hủy', className: 'status-cancelled', icon: <XCircle size={14} /> };
    }
  };

  return (
    <div className="my-orders-page">
      {/* Header */}
      <header className="my-orders-header">
        {onBack && (
          <div className="my-orders-top-nav">
            <button className="my-orders-back-btn" onClick={onBack} aria-label="Quay lại">
              <ChevronLeft size={18} />
              <span>Quay lại</span>
            </button>
          </div>
        )}
        <div className="my-orders-title-row">
          <div className="my-orders-icon-wrap">
            <Receipt size={22} color="#B68438" />
          </div>
          <div>
            <h1 className="my-orders-title">Đơn hàng của tôi</h1>
            <p className="my-orders-subtitle">
              Danh sách các đơn gọi món tại <strong className="table-highlight">{currentTable?.name || 'Bàn số 1'}</strong>
            </p>
          </div>
        </div>
      </header>

      {/* Tabs Filter */}
      <div className="my-orders-tabs">
        <button
          className={`orders-tab-btn ${filterTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => setFilterTab('ACTIVE')}
        >
          <span>Đang xử lý</span>
          <span className="tab-pill">{activeOrders.length}</span>
        </button>

        <button
          className={`orders-tab-btn ${filterTab === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setFilterTab('COMPLETED')}
        >
          <span>Đã hoàn thành</span>
          <span className="tab-pill">{completedOrders.length}</span>
        </button>

        <button
          className={`orders-tab-btn ${filterTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterTab('ALL')}
        >
          <span>Tất cả</span>
          <span className="tab-pill">{tableOrders.length}</span>
        </button>
      </div>

      {/* Order List / Empty State */}
      <div className="my-orders-content">
        {filteredOrders.length === 0 ? (
          <div className="my-orders-empty">
            <div className="empty-icon-circle">
              <ShoppingBag size={48} strokeWidth={1.5} color="#B68438" />
            </div>
            <h3 className="empty-title">Bạn chưa có đơn hàng nào</h3>
            <p className="empty-subtitle">
              {filterTab === 'ACTIVE'
                ? 'Hiện tại bàn của bạn không có đơn nào đang chờ xử lý.'
                : 'Chọn một món ngon từ thực đơn ANA Chiang Mai nhé.'}
            </p>
            <button className="empty-cta-btn" onClick={onExploreMenu}>
              <span>Khám phá thực đơn</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="orders-cards-stack">
            {filteredOrders.map(order => {
              const statusInfo = getStatusInfo(order.status);
              const totalItems = order.items.reduce((sum, it) => sum + it.quantity, 0);
              const timeFormatted = new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const dateFormatted = new Date(order.createdAt).toLocaleDateString('vi-VN');

              return (
                <div
                  key={order.id}
                  className={`my-order-card ${statusInfo.className}`}
                  onClick={() => onOpenOrderDetail(order.id)}
                >
                  {/* Card Header */}
                  <div className="order-card-header">
                    <div className="order-code-group">
                      <span className="order-num">#{order.orderNumber}</span>
                      <span className="order-time-text">{timeFormatted} • {dateFormatted}</span>
                    </div>

                    <div className={`order-status-badge ${statusInfo.className}`}>
                      {statusInfo.icon}
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="order-items-preview">
                    <div className="preview-thumbnails">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <img
                          key={item.id || idx}
                          src={item.image || '/coffee_img/1.png'}
                          alt={item.productName}
                          className="preview-item-img"
                        />
                      ))}
                      {order.items.length > 3 && (
                        <div className="preview-more-badge">+{order.items.length - 3}</div>
                      )}
                    </div>

                    <div className="preview-summary-text">
                      {order.items.map(it => `${it.productName} × ${it.quantity}`).join(', ')}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="order-card-footer">
                    <div className="order-price-col">
                      <span className="order-total-label">{totalItems} món • Tổng:</span>
                      <strong className="order-total-val">{formatVND(order.total)}</strong>
                    </div>

                    <div className="order-card-actions">
                      {order.status === 'NEW' && (
                        <button
                          className="order-card-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartEditOrder(order);
                          }}
                          title="Chỉnh sửa đơn hàng"
                        >
                          <Edit3 size={13} />
                          <span>Sửa đơn</span>
                        </button>
                      )}

                      <div className="order-card-detail-hint">
                        <span>Chi tiết</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
