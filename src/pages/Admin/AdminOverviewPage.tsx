import React from 'react';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Flame,
  Activity
} from 'lucide-react';
import { storeService } from '../../services/storeService';
import { useStore } from '../../context/StoreContext';
import './AdminOverviewPage.css';

interface AdminOverviewPageProps {
  onNavigateToOrders: (statusFilter?: string) => void;
  onNavigateToRevenue: () => void;
}

export const AdminOverviewPage: React.FC<AdminOverviewPageProps> = ({
  onNavigateToOrders,
  onNavigateToRevenue
}) => {
  const { orders, openOrderDetail, adminNotifications } = useStore();
  const stats = storeService.getRevenueStats();

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="admin-overview-page">
      {/* 1. Page Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Tổng quan hoạt động</h1>
          <p className="admin-page-subtitle">
            Hệ thống đặt món & quản trị quán ANA CHIANG MAI
          </p>
        </div>
        <div className="header-badge-wrap">
          <span className="live-pulse-dot"></span>
          <span className="live-status-text">Hệ thống Realtime đang kết nối</span>
        </div>
      </div>

      {/* 2. Key Metrics KPIs */}
      <div className="overview-kpi-grid">
        {/* Doanh thu hôm nay */}
        <div className="kpi-card highlight-gold" onClick={onNavigateToRevenue}>
          <div className="kpi-header">
            <span className="kpi-label">DOANH THU HÔM NAY</span>
            <div className="kpi-icon-wrap gold">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="kpi-value">{formatVND(stats.todayRevenue)}</div>
          <div className="kpi-footer">
            <span>{stats.completedTodayCount} đơn đã hoàn thành</span>
          </div>
        </div>

        {/* Doanh thu tháng này */}
        <div className="kpi-card" onClick={onNavigateToRevenue}>
          <div className="kpi-header">
            <span className="kpi-label">DOANH THU THÁNG NÀY</span>
            <div className="kpi-icon-wrap terracotta">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value">{formatVND(stats.monthRevenue)}</div>
          <div className="kpi-footer">
            <span>Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</span>
          </div>
        </div>

        {/* Doanh thu năm */}
        <div className="kpi-card" onClick={onNavigateToRevenue}>
          <div className="kpi-header">
            <span className="kpi-label">DOANH THU NĂM {new Date().getFullYear()}</span>
            <div className="kpi-icon-wrap jade">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="kpi-value">{formatVND(stats.yearRevenue)}</div>
          <div className="kpi-footer">
            <span>{stats.totalCompletedOrders} đơn cả năm</span>
          </div>
        </div>

        {/* Đơn mới đang chờ */}
        <div
          className={`kpi-card ${stats.newOrdersCount > 0 ? 'alert-new' : ''}`}
          onClick={() => onNavigateToOrders('NEW')}
        >
          <div className="kpi-header">
            <span className="kpi-label">ĐƠN MỚI CHƯA NHẬN</span>
            <div className="kpi-icon-wrap orange">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="kpi-value">
            {stats.newOrdersCount}
            {stats.newOrdersCount > 0 && <span className="kpi-badge-alert">Cần xử lý</span>}
          </div>
          <div className="kpi-footer">
            <span>Xem danh sách đơn mới →</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Status Row */}
      <div className="operational-status-bar">
        <div className="ops-item" onClick={() => onNavigateToOrders('NEW')}>
          <div className="ops-dot new"></div>
          <span className="ops-name">Đơn mới:</span>
          <strong className="ops-count">{stats.newOrdersCount}</strong>
        </div>
        <div className="ops-divider"></div>
        <div className="ops-item" onClick={() => onNavigateToOrders('PREPARING')}>
          <div className="ops-dot prep"></div>
          <span className="ops-name">Đang chuẩn bị:</span>
          <strong className="ops-count">{stats.preparingCount}</strong>
        </div>
        <div className="ops-divider"></div>
        <div className="ops-item" onClick={() => onNavigateToOrders('READY')}>
          <div className="ops-dot ready"></div>
          <span className="ops-name">Sẵn sàng phục vụ:</span>
          <strong className="ops-count">{stats.readyCount}</strong>
        </div>
        <div className="ops-divider"></div>
        <div className="ops-item" onClick={() => onNavigateToOrders('COMPLETED')}>
          <div className="ops-dot done"></div>
          <span className="ops-name">Đã hoàn thành hôm nay:</span>
          <strong className="ops-count">{stats.completedTodayCount}</strong>
        </div>
      </div>

      {/* 4. Two Columns: Live Orders & Top Selling Products */}
      <div className="overview-two-col">
        {/* Left: Recent Live Orders */}
        <div className="overview-panel">
          <div className="panel-header">
            <div className="panel-title-row">
              <Clock size={18} className="panel-icon" />
              <h2 className="panel-title">Đơn hàng vừa phát sinh</h2>
            </div>
            <button className="panel-action-btn" onClick={() => onNavigateToOrders()}>
              <span>Xem tất cả</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="recent-orders-table">
            {recentOrders.length === 0 ? (
              <p className="empty-panel-text">Chưa có đơn hàng nào trong ca</p>
            ) : (
              recentOrders.map((order) => {
                const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const time = new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={order.id}
                    className="order-feed-item"
                    onClick={() => {
                      openOrderDetail(order.id);
                      onNavigateToOrders();
                    }}
                  >
                    <div className="feed-table-badge">
                      <span className="table-name">{order.tableName}</span>
                      <span className="order-time">{time}</span>
                    </div>

                    <div className="feed-items-col">
                      <div className="feed-code">{order.orderNumber}</div>
                      <div className="feed-summary">
                        {order.items.map((it) => `${it.productName} × ${it.quantity}`).join(', ')}
                      </div>
                    </div>

                    <div className="feed-price-col">
                      <div className="feed-total">{order.total}K</div>
                      <div className="feed-count">{totalQty} món</div>
                    </div>

                    <div className={`feed-status-badge status-${order.status.toLowerCase()}`}>
                      {order.status === 'NEW' && 'Đơn mới'}
                      {order.status === 'CONFIRMED' && 'Đã nhận'}
                      {order.status === 'PREPARING' && 'Đang làm'}
                      {order.status === 'READY' && 'Sẵn sàng'}
                      {order.status === 'COMPLETED' && 'Hoàn thành'}
                      {order.status === 'CANCELLED' && 'Đã hủy'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Top Selling Signature Items */}
        <div className="overview-panel">
          <div className="panel-header">
            <div className="panel-title-row">
              <Flame size={18} className="panel-icon flame" />
              <h2 className="panel-title">Món bán chạy nhất</h2>
            </div>
            <button className="panel-action-btn" onClick={onNavigateToRevenue}>
              <span>Chi tiết</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="top-products-list">
            {stats.topProducts.length === 0 ? (
              <p className="empty-panel-text">Chưa có dữ liệu bán hàng</p>
            ) : (
              stats.topProducts.slice(0, 6).map((item, index) => (
                <div key={item.productId} className="top-product-item">
                  <div className={`rank-badge rank-${index + 1}`}>{index + 1}</div>
                  <img src={item.image} alt={item.productName} className="top-prod-thumb" />
                  <div className="top-prod-info">
                    <span className="top-prod-name">{item.productName}</span>
                    <span className="top-prod-sub">{item.totalQuantity} ly đã bán</span>
                  </div>
                  <div className="top-prod-rev">{formatVND(item.totalRevenue)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Recent Customer Activity Feed */}
      <div className="overview-panel full-width-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <Activity size={18} className="panel-icon activity" />
            <h2 className="panel-title">Hoạt động khách hàng gần đây</h2>
          </div>
          <span className="activity-live-badge">Realtime Push</span>
        </div>

        <div className="activity-feed-list">
          {adminNotifications.length === 0 ? (
            <p className="empty-panel-text">Chưa có hoạt động nào từ khách hàng</p>
          ) : (
            adminNotifications.slice(0, 8).map((notif) => {
              const timeFormatted = new Date(notif.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={notif.id}
                  className="activity-feed-row"
                  onClick={() => {
                    onNavigateToOrders('ALL');
                    openOrderDetail(notif.orderId || notif.orderNumber);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="act-time">{timeFormatted}</div>
                  <div className="act-code">#{notif.orderNumber}</div>
                  <div className="act-table">{notif.tableName}</div>
                  <div className="act-msg">{notif.message}</div>
                  <div className="act-view">
                    <span>Xem đơn</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
