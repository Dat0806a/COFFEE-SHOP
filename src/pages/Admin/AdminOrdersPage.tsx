import React, { useState } from 'react';
import {
  Check,
  ChefHat,
  Bell,
  CheckCheck,
  XCircle,
  Search,
  Filter,
  Receipt,
  Eye
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { OrderStatus, compareAdminOrders } from '../../types';
import { OrderDetailsModal } from '../../components/admin/OrderDetailsModal/OrderDetailsModal';
import './AdminOrdersPage.css';

interface AdminOrdersPageProps {
  initialStatusFilter?: string;
}

type TabKey = 'ALL' | 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({
  initialStatusFilter
}) => {
  const {
    orders,
    updateOrderStatus,
    selectedOrderIdForDetail,
    openOrderDetail,
    closeOrderDetail
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey>(
    (initialStatusFilter as TabKey) || 'ALL'
  );
  const [selectedTable, setSelectedTable] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync tab when initialStatusFilter changes from external navigation
  React.useEffect(() => {
    if (initialStatusFilter) {
      setActiveTab(initialStatusFilter as TabKey);
    }
  }, [initialStatusFilter]);

  // Selected order for detail modal
  const activeModalOrder = selectedOrderIdForDetail
    ? orders.find((o) => o.id === selectedOrderIdForDetail) || null
    : null;

  // Filter orders
  const filteredOrders = orders
    .filter((order) => {
      // 1. Tab filter
      if (activeTab !== 'ALL' && order.status !== activeTab) {
        return false;
      }

      // 2. Table filter
      if (selectedTable !== 'ALL' && order.tableNumber !== selectedTable) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = order.orderNumber.toLowerCase().includes(q);
        const matchTable = order.tableName.toLowerCase().includes(q);
        const matchItem = order.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!matchCode && !matchTable && !matchItem) return false;
      }

      return true;
    })
    .sort(compareAdminOrders);

  const tabCounts = {
    ALL: orders.length,
    NEW: orders.filter((o) => o.status === 'NEW').length,
    CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
    COMPLETED: orders.filter((o) => o.status === 'COMPLETED').length,
    CANCELLED: orders.filter((o) => o.status === 'CANCELLED').length
  };

  const handleStatusTransition = (orderId: string, nextStatus: OrderStatus) => {
    updateOrderStatus(orderId, nextStatus);
  };

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="admin-orders-page">
      {/* 1. Page Header */}
      <div className="orders-page-header">
        <div>
          <h1 className="admin-page-title">Quản lý Đơn hàng</h1>
          <p className="admin-page-subtitle">
            Theo dõi, xử lý và điều phối các đơn gọi món từ 5 bàn realtime
          </p>
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
      <div className="orders-control-bar">
        {/* Search */}
        <div className="orders-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn (#ANA-...), số bàn, tên món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Table Selector Filter */}
        <div className="orders-table-filter">
          <Filter size={15} className="filter-icon" />
          <span className="filter-label">Lọc bàn:</span>
          <div className="table-pill-group">
            <button
              className={`table-pill ${selectedTable === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedTable('ALL')}
            >
              Tất cả
            </button>
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                className={`table-pill ${selectedTable === num ? 'active' : ''}`}
                onClick={() => setSelectedTable(num)}
              >
                Bàn {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Status Tabs Navigation */}
      <div className="orders-tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          <span>Tất cả</span>
          <span className="tab-count">{tabCounts.ALL}</span>
        </button>

        <button
          className={`tab-btn tab-new ${activeTab === 'NEW' ? 'active' : ''}`}
          onClick={() => setActiveTab('NEW')}
        >
          <span>Đơn mới</span>
          {tabCounts.NEW > 0 && <span className="tab-count alert">{tabCounts.NEW}</span>}
        </button>

        <button
          className={`tab-btn ${activeTab === 'CONFIRMED' ? 'active' : ''}`}
          onClick={() => setActiveTab('CONFIRMED')}
        >
          <span>Đã xác nhận</span>
          <span className="tab-count">{tabCounts.CONFIRMED}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'PREPARING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PREPARING')}
        >
          <span>Đang chuẩn bị</span>
          <span className="tab-count">{tabCounts.PREPARING}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'READY' ? 'active' : ''}`}
          onClick={() => setActiveTab('READY')}
        >
          <span>Sẵn sàng</span>
          <span className="tab-count">{tabCounts.READY}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setActiveTab('COMPLETED')}
        >
          <span>Hoàn thành</span>
          <span className="tab-count">{tabCounts.COMPLETED}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'CANCELLED' ? 'active' : ''}`}
          onClick={() => setActiveTab('CANCELLED')}
        >
          <span>Đã hủy</span>
          <span className="tab-count">{tabCounts.CANCELLED}</span>
        </button>
      </div>

      {/* 4. Orders List Grid */}
      <div className="orders-list-container">
        {filteredOrders.length === 0 ? (
          <div className="orders-empty-state">
            <Receipt size={40} className="empty-icon" />
            <h3>Không có đơn hàng nào</h3>
            <p>Hiện không có đơn hàng nào trong trạng thái hoặc bộ lọc đã chọn.</p>
          </div>
        ) : (
          <div className="orders-cards-grid">
            {filteredOrders.map((order) => {
              const totalItemsCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0
              );
              const createdAtDate = new Date(order.createdAt);
              const timeStr = createdAtDate.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const dateStr = createdAtDate.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });

              return (
                <div
                  key={order.id}
                  className={`admin-order-card status-border-${order.status.toLowerCase()}`}
                  onClick={() => openOrderDetail(order.id)}
                >
                  {/* Card Head */}
                  <div className="order-card-header">
                    <div className="order-card-table-badge">
                      <span className="table-title">{order.tableName}</span>
                      <span className="order-time-stamp">
                        {timeStr} • {dateStr}
                      </span>
                    </div>

                    <div className="order-card-code-status">
                      <span className="order-code-text">#{order.orderNumber}</span>
                      <div className="order-badges-stack">
                        <span
                          className={`order-status-pill status-${order.status.toLowerCase()}`}
                        >
                          {order.status === 'NEW' && 'ĐƠN MỚI'}
                          {order.status === 'CONFIRMED' && 'ĐÃ XÁC NHẬN'}
                          {order.status === 'PREPARING' && 'ĐANG CHUẨN BỊ'}
                          {order.status === 'READY' && 'SẴN SÀNG'}
                          {order.status === 'COMPLETED' && 'ĐÃ HOÀN THÀNH'}
                          {order.status === 'CANCELLED' && 'ĐÃ HỦY'}
                        </span>

                        <span className={`order-pay-pill pay-${order.paymentStatus?.toLowerCase() || 'pending'}`}>
                          {order.paymentMethod === 'BANK_TRANSFER' ? 'CK' : 'TM'} • {' '}
                          {order.paymentStatus === 'PAID' && 'Đã thanh toán'}
                          {order.paymentStatus === 'VERIFYING' && 'Chờ xác minh'}
                          {order.paymentStatus === 'PENDING' && (
                            order.paymentMethod === 'BANK_TRANSFER' ? 'Chưa gửi ảnh' : 'Chờ quầy'
                          )}
                          {order.paymentStatus === 'REJECTED' && 'Ảnh lỗi'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Items List */}
                  <div className="order-items-details-box">
                    {order.items.map((item, itIdx) => (
                      <div key={item.id || itIdx} className="order-item-row">
                        <div className="item-name-col">
                          <span className="item-qty-badge">×{item.quantity}</span>
                          <span className="item-prod-name">{item.productName}</span>
                        </div>

                        {/* Options / Customization */}
                        {(item.selectedSize ||
                          item.sugarLevel ||
                          item.iceLevel ||
                          (item.toppings && item.toppings.length > 0)) && (
                          <div className="item-customs-tag">
                            {[
                              item.selectedSize && `Size ${item.selectedSize}`,
                              item.sugarLevel && `Đường ${item.sugarLevel}`,
                              item.iceLevel && (item.iceLevel === '0%' ? 'Không đá' : `Đá ${item.iceLevel}`),
                              item.toppings && item.toppings.length > 0 && `+${item.toppings.join(', ')}`
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}

                        <span className="item-subtotal-price">{formatVND(item.totalPrice)}</span>
                      </div>
                    ))}

                    {order.note && (
                      <div className="order-note-display">
                        <strong>Ghi chú:</strong> "{order.note}"
                      </div>
                    )}
                  </div>

                  {/* Card Footer Summary */}
                  <div className="order-card-summary-row" onClick={(e) => e.stopPropagation()}>
                    <div className="order-totals-info">
                      <span className="order-item-count">{totalItemsCount} món</span>
                      <span className="order-grand-total">{formatVND(order.total)}</span>
                    </div>

                    {/* Action Transitions */}
                    <div className="order-actions-row">
                      <button
                        className="order-act-btn detail-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderDetail(order.id);
                        }}
                        title="Xem toàn bộ chi tiết đơn"
                      >
                        <Eye size={14} />
                        <span>Xem đơn</span>
                      </button>

                      {order.status === 'NEW' && (
                        <>
                          <button
                            className="order-act-btn cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusTransition(order.id, 'CANCELLED');
                            }}
                          >
                            <XCircle size={15} />
                            <span>Hủy</span>
                          </button>
                          <button
                            className={`order-act-btn confirm ${order.paymentStatus !== 'PAID' ? 'confirm-locked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (order.paymentStatus !== 'PAID') {
                                openOrderDetail(order.id);
                                return;
                              }
                              handleStatusTransition(order.id, 'CONFIRMED');
                            }}
                            title={order.paymentStatus !== 'PAID' ? 'Vui lòng xác nhận thanh toán trước.' : 'Xác nhận đơn'}
                          >
                            <Check size={15} />
                            <span>{order.paymentStatus !== 'PAID' ? 'Duyệt TT' : 'Xác nhận'}</span>
                          </button>
                        </>
                      )}

                      {order.status === 'CONFIRMED' && (
                        <>
                          <button
                            className="order-act-btn cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusTransition(order.id, 'CANCELLED');
                            }}
                          >
                            <XCircle size={15} />
                            <span>Hủy</span>
                          </button>
                          <button
                            className="order-act-btn prep"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusTransition(order.id, 'PREPARING');
                            }}
                          >
                            <ChefHat size={15} />
                            <span>Làm món</span>
                          </button>
                        </>
                      )}

                      {order.status === 'PREPARING' && (
                        <>
                          <button
                            className="order-act-btn cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusTransition(order.id, 'CANCELLED');
                            }}
                          >
                            <XCircle size={15} />
                            <span>Hủy</span>
                          </button>
                          <button
                            className="order-act-btn ready"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusTransition(order.id, 'READY');
                            }}
                          >
                            <Bell size={15} />
                            <span>Báo sẵn sàng</span>
                          </button>
                        </>
                      )}

                      {order.status === 'READY' && (
                        <button
                          className="order-act-btn complete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusTransition(order.id, 'COMPLETED');
                          }}
                        >
                          <CheckCheck size={16} />
                          <span>Khách đã nhận</span>
                        </button>
                      )}

                      {order.status === 'COMPLETED' && (
                        <div className="order-finished-tag done">
                          <CheckCheck size={16} />
                          <span>Đã xong</span>
                        </div>
                      )}

                      {order.status === 'CANCELLED' && (
                        <div className="order-finished-tag cancelled">
                          <XCircle size={16} />
                          <span>Đã hủy</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailsModal
        order={activeModalOrder}
        isOpen={Boolean(activeModalOrder)}
        onClose={closeOrderDetail}
        onUpdateStatus={updateOrderStatus}
      />
    </div>
  );
};

