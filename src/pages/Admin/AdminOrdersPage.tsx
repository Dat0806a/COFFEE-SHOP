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
  Eye,
  Clock,
  Sparkles
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  OrderStatus,
  OrderRecord,
  compareAdminOrders,
  getVietnamCurrentMonth,
  getVietnamYearMonth
} from '../../types';
import { OrderDetailsModal } from '../../components/admin/OrderDetailsModal/OrderDetailsModal';
import './AdminOrdersPage.css';

interface AdminOrdersPageProps {
  initialStatusFilter?: string;
}

type MainViewTab = 'PROCESSING' | 'COMPLETED';
type ProcessingTabKey = 'ALL' | 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'CANCELLED';

export const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({
  initialStatusFilter
}) => {
  const {
    orders,
    updateOrderStatus,
    selectedOrderIdForDetail,
    openOrderDetail,
    closeOrderDetail,
    cleanupExpiredUnacceptedOrders
  } = useStore();

  const isInitialCompleted = initialStatusFilter === 'COMPLETED';
  const [mainViewTab, setMainViewTab] = useState<MainViewTab>(
    isInitialCompleted ? 'COMPLETED' : 'PROCESSING'
  );
  const [processingSubTab, setProcessingSubTab] = useState<ProcessingTabKey>(
    (!isInitialCompleted && (initialStatusFilter as ProcessingTabKey)) || 'ALL'
  );
  const [selectedTable, setSelectedTable] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-cleanup unaccepted orders older than 1 hour on mount & periodic 30s check
  React.useEffect(() => {
    cleanupExpiredUnacceptedOrders();
    const interval = setInterval(() => {
      cleanupExpiredUnacceptedOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [cleanupExpiredUnacceptedOrders]);

  // Sync tab when initialStatusFilter changes from external navigation
  React.useEffect(() => {
    if (initialStatusFilter === 'COMPLETED') {
      setMainViewTab('COMPLETED');
    } else if (initialStatusFilter) {
      setMainViewTab('PROCESSING');
      setProcessingSubTab(initialStatusFilter as ProcessingTabKey);
    }
  }, [initialStatusFilter]);

  // Selected order for detail modal
  const activeModalOrder = selectedOrderIdForDetail
    ? orders.find((o) => o.id === selectedOrderIdForDetail) || null
    : null;

  const currentVietnamMonth = getVietnamCurrentMonth(); // "YYYY-MM"
  const currentMonthNum = parseInt(currentVietnamMonth.slice(5, 7), 10) || (new Date().getMonth() + 1);
  const currentYearNum = parseInt(currentVietnamMonth.slice(0, 4), 10) || new Date().getFullYear();

  // All processing (non-completed) orders
  const allProcessingOrders = orders.filter((o) => o.status !== 'COMPLETED');

  // All completed orders of the CURRENT Vietnam month
  const currentMonthCompletedOrders = orders.filter((o) => {
    if (o.status !== 'COMPLETED' || !o.completedAt) return false;
    return getVietnamYearMonth(o.completedAt) === currentVietnamMonth;
  }).sort((a, b) => {
    const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return compareAdminOrders(a, b);
  });

  // Calculate counts
  const processingTabCounts = {
    ALL: allProcessingOrders.length,
    NEW: allProcessingOrders.filter((o) => o.status === 'NEW').length,
    CONFIRMED: allProcessingOrders.filter((o) => o.status === 'CONFIRMED').length,
    PREPARING: allProcessingOrders.filter((o) => o.status === 'PREPARING').length,
    READY: allProcessingOrders.filter((o) => o.status === 'READY').length,
    CANCELLED: allProcessingOrders.filter((o) => o.status === 'CANCELLED').length
  };

  const completedMonthCount = currentMonthCompletedOrders.length;
  const completedMonthTotalRev = currentMonthCompletedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Apply filters based on current main tab
  let displayOrders: OrderRecord[] = [];

  if (mainViewTab === 'PROCESSING') {
    displayOrders = allProcessingOrders
      .filter((order) => {
        // Sub-tab filter
        if (processingSubTab !== 'ALL' && order.status !== processingSubTab) {
          return false;
        }
        // Table filter
        if (selectedTable !== 'ALL' && order.tableNumber !== selectedTable) {
          return false;
        }
        // Search query
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
  } else {
    // COMPLETED tab
    displayOrders = currentMonthCompletedOrders.filter((order) => {
      // Table filter
      if (selectedTable !== 'ALL' && order.tableNumber !== selectedTable) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = order.orderNumber.toLowerCase().includes(q);
        const matchTable = order.tableName.toLowerCase().includes(q);
        const matchItem = order.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!matchCode && !matchTable && !matchItem) return false;
      }
      return true;
    });
  }

  const handleStatusTransition = (orderId: string, nextStatus: OrderStatus) => {
    updateOrderStatus(orderId, nextStatus);
  };

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${timeStr} • ${dateStr}`;
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

      {/* 2. Top-Level Main Tabs: [ Đang xử lý ] vs [ Đã hoàn thành ] */}
      <div className="orders-main-tabs-switcher">
        <button
          className={`main-tab-button ${mainViewTab === 'PROCESSING' ? 'active' : ''}`}
          onClick={() => setMainViewTab('PROCESSING')}
        >
          <Clock size={16} />
          <span>Đang xử lý</span>
          <span className="main-tab-badge processing-badge">
            {allProcessingOrders.length}
          </span>
        </button>

        <button
          className={`main-tab-button ${mainViewTab === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setMainViewTab('COMPLETED')}
        >
          <CheckCheck size={16} />
          <span>Đã hoàn thành</span>
          <span className="main-tab-badge completed-badge">
            {completedMonthCount}
          </span>
        </button>
      </div>

      {/* 3. Filter Bar & Search */}
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

      {/* 4. Sub-Navigation / Status Pills (For Processing Tab) or Month Banner (For Completed Tab) */}
      {mainViewTab === 'PROCESSING' ? (
        <div className="orders-tabs-nav">
          <button
            className={`tab-btn ${processingSubTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('ALL')}
          >
            <span>Tất cả</span>
            <span className="tab-count">{processingTabCounts.ALL}</span>
          </button>

          <button
            className={`tab-btn tab-new ${processingSubTab === 'NEW' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('NEW')}
          >
            <span>Đơn mới</span>
            {processingTabCounts.NEW > 0 && (
              <span className="tab-count alert">{processingTabCounts.NEW}</span>
            )}
          </button>

          <button
            className={`tab-btn ${processingSubTab === 'CONFIRMED' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('CONFIRMED')}
          >
            <span>Đã xác nhận</span>
            <span className="tab-count">{processingTabCounts.CONFIRMED}</span>
          </button>

          <button
            className={`tab-btn ${processingSubTab === 'PREPARING' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('PREPARING')}
          >
            <span>Đang chuẩn bị</span>
            <span className="tab-count">{processingTabCounts.PREPARING}</span>
          </button>

          <button
            className={`tab-btn ${processingSubTab === 'READY' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('READY')}
          >
            <span>Sẵn sàng</span>
            <span className="tab-count">{processingTabCounts.READY}</span>
          </button>

          <button
            className={`tab-btn ${processingSubTab === 'CANCELLED' ? 'active' : ''}`}
            onClick={() => setProcessingSubTab('CANCELLED')}
          >
            <span>Đã hủy</span>
            <span className="tab-count">{processingTabCounts.CANCELLED}</span>
          </button>
        </div>
      ) : (
        <div className="completed-month-banner">
          <div className="completed-month-info">
            <Sparkles size={16} className="sparkle-icon" />
            <span>
              Đơn hoàn thành trong <strong>Tháng {currentMonthNum}/{currentYearNum}</strong>:
            </span>
            <span className="completed-summary-pill">
              {completedMonthCount} đơn
            </span>
            <span className="completed-summary-pill highlight">
              Doanh thu: {formatVND(completedMonthTotalRev)}
            </span>
          </div>
          <span className="completed-sort-tip">Sắp xếp theo thời gian hoàn thành mới nhất</span>
        </div>
      )}

      {/* 5. Orders List Grid */}
      <div className="orders-list-container">
        {displayOrders.length === 0 ? (
          <div className="orders-empty-state">
            <Receipt size={40} className="empty-icon" />
            <h3>
              {mainViewTab === 'PROCESSING'
                ? 'Không có đơn hàng nào đang xử lý'
                : `Chưa có đơn hàng nào hoàn thành trong Tháng ${currentMonthNum}/${currentYearNum}`}
            </h3>
            <p>
              {mainViewTab === 'PROCESSING'
                ? 'Hiện không có đơn hàng nào trong trạng thái hoặc bộ lọc đã chọn.'
                : 'Các đơn hoàn thành trong tháng hiện tại sẽ được lưu và hiển thị tại đây.'}
            </p>
          </div>
        ) : (
          <div className="orders-cards-grid">
            {displayOrders.map((order) => {
              const totalItemsCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0
              );

              return (
                <div
                  key={order.id}
                  className={`admin-order-card status-border-${order.status.toLowerCase()} ${
                    order.status === 'COMPLETED' ? 'completed-card' : ''
                  }`}
                  onClick={() => openOrderDetail(order.id)}
                >
                  {/* Card Head */}
                  <div className="order-card-header">
                    <div className="order-card-table-badge">
                      <span className="table-title">{order.tableName}</span>
                      <span className="order-time-stamp" title="Thời gian đặt món">
                        <Clock size={11} /> {formatDateTime(order.createdAt)}
                      </span>
                      {order.completedAt && (
                        <span className="order-completed-timestamp" title="Thời gian hoàn thành">
                          <CheckCheck size={12} /> Xong: {formatDateTime(order.completedAt)}
                        </span>
                      )}
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

                        <span
                          className={`order-pay-pill pay-${
                            order.paymentStatus?.toLowerCase() || 'pending'
                          }`}
                        >
                          {order.paymentMethod === 'BANK_TRANSFER' ? 'CK' : 'TM'} •{' '}
                          {order.paymentStatus === 'PAID' && 'Đã thanh toán'}
                          {order.paymentStatus === 'VERIFYING' && 'Chờ xác minh'}
                          {order.paymentStatus === 'PENDING' &&
                            (order.paymentMethod === 'BANK_TRANSFER'
                              ? 'Chưa gửi ảnh'
                              : 'Chờ quầy')}
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
                              item.iceLevel &&
                                (item.iceLevel === '0%' ? 'Không đá' : `Đá ${item.iceLevel}`),
                              item.toppings &&
                                item.toppings.length > 0 &&
                                `+${item.toppings.join(', ')}`
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}

                        <span className="item-subtotal-price">
                          {formatVND(item.totalPrice)}
                        </span>
                      </div>
                    ))}

                    {order.note && (
                      <div className="order-note-display">
                        <strong>Ghi chú:</strong> "{order.note}"
                      </div>
                    )}
                  </div>

                  {/* Card Footer Summary */}
                  <div
                    className="order-card-summary-row"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                            className={`order-act-btn confirm ${
                              order.paymentStatus !== 'PAID' ? 'confirm-locked' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (order.paymentStatus !== 'PAID') {
                                openOrderDetail(order.id);
                                return;
                              }
                              handleStatusTransition(order.id, 'CONFIRMED');
                            }}
                            title={
                              order.paymentStatus !== 'PAID'
                                ? 'Vui lòng xác nhận thanh toán trước.'
                                : 'Xác nhận đơn'
                            }
                          >
                            <Check size={15} />
                            <span>
                              {order.paymentStatus !== 'PAID' ? 'Duyệt TT' : 'Xác nhận'}
                            </span>
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
