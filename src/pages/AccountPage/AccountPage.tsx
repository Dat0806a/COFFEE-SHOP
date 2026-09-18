import React, { useState } from 'react';
import {
  ShoppingBag,
  Award,
  Ticket,
  MapPin,
  User,
  CreditCard,
  Bell,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Utensils,
  ArrowLeftRight
} from 'lucide-react';
import { currentUser } from '../../data/user';
import { useTableSession } from '../../context/TableSessionContext';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import { OrderRecord, OrderItemRecord, getOrderActivityTimestamp } from '../../types';
import { ChangeTableModal } from '../../components/common/ChangeTableModal/ChangeTableModal';
import { AboutAppModal } from '../../components/modals/AboutAppModal';
import { AdminAuthModal } from '../../components/modals/AdminAuthModal/AdminAuthModal';
import { DeveloperFooter } from '../../components/common/DeveloperFooter/DeveloperFooter';
import './AccountPage.css';

interface AccountPageProps {
  onNavigateToOffers: () => void;
  onNavigateToMyOrders: () => void;
  onOpenOrderDetail: (orderId: string) => void;
  onNavigateToAdmin?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onNavigateToOffers,
  onNavigateToMyOrders,
  onOpenOrderDetail,
  onNavigateToAdmin
}) => {
  const { currentTable, clearTableSession, sessionOrderIds } = useTableSession();
  const { clearCart, cartItems } = useCart();
  const { orders } = useStore();
  const [isChangeTableModalOpen, setIsChangeTableModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  const tableNumber = currentTable?.tableNumber || 1;
  const realTableOrders = orders
    .filter(o => o.tableNumber === tableNumber && sessionOrderIds.includes(o.id))
    .sort((a, b) => getOrderActivityTimestamp(b) - getOrderActivityTimestamp(a));

  const pointsProgress = Math.round((currentUser.currentPoints / currentUser.nextTierPoints) * 100);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'NEW': return 'Đã gửi';
      case 'CONFIRMED': return 'Quán đã nhận';
      case 'PREPARING': return 'Đang làm món';
      case 'READY': return 'Sẵn sàng phục vụ';
      case 'COMPLETED': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  };

  const handleChangeTableClick = () => {
    if (cartItems.length > 0) {
      setIsChangeTableModalOpen(true);
    } else {
      if (currentTable) {
        clearCart(currentTable.tableNumber);
      }
      clearTableSession();
    }
  };

  const handleConfirmChangeTable = () => {
    setIsChangeTableModalOpen(false);
    if (currentTable) {
      clearCart(currentTable.tableNumber);
    }
    clearTableSession();
  };

  return (
    <div className="account-page">
      {/* 1. Profile Header */}
      <header className="account-header">
        <div className="account-profile-row">
          <div className="account-avatar-wrap">
            <img src={currentUser.avatar} alt={currentTable?.name || currentUser.name} className="account-avatar-img" />
            <span className="tier-badge-icon">👑</span>
          </div>

          <div className="account-profile-info">
            <span className="profile-greeting">Xin chào,</span>
            <h1 className="profile-name">{currentTable?.name || currentUser.name}</h1>
            <div className="profile-tier-pill">
              <Sparkles size={11} color="#C5974A" />
              <span>{currentUser.memberTier}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 1b. Current Table Session Card */}
      <div className="current-table-status-wrapper">
        <div className="current-table-status-card">
          <div className="table-status-left">
            <div className="table-status-icon-box">
              <Utensils size={18} color="#C7521E" />
            </div>
            <div className="table-status-text">
              <span className="table-status-hint">Bạn đang gọi món tại</span>
              <strong className="table-status-name">{currentTable?.name || 'Bàn số 1'}</strong>
            </div>
          </div>

          <button
            type="button"
            className="change-table-action-btn"
            onClick={handleChangeTableClick}
            aria-label="Đổi bàn"
          >
            <RefreshCw size={14} className="change-table-icon" />
            <span>Đổi bàn</span>
          </button>
        </div>
      </div>

      {/* 2. Membership Card */}
      <div className="member-card-wrapper">
        <div className="member-card">
          <div className="card-top-row">
            <div className="card-brand-group">
              <span className="card-brand-title">ANA CHIANG MAI</span>
              <span className="card-brand-sub">Thai Drink & Dessert</span>
            </div>
            <span className="card-member-tag">ANA MEMBER</span>
          </div>

          <div className="card-middle-points">
            <span className="points-label">Điểm hiện tại</span>
            <div className="points-value-row">
              <span className="points-number">{currentUser.currentPoints.toLocaleString()}</span>
              <span className="points-unit">điểm</span>
            </div>
          </div>

          {/* Progress to next tier */}
          <div className="card-progress-section">
            <div className="progress-labels">
              <span>{currentUser.memberTier}</span>
              <span>{currentUser.currentPoints} / {currentUser.nextTierPoints} điểm</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pointsProgress}%` }} />
            </div>
            <span className="progress-hint">
              Tích thêm {currentUser.nextTierPoints - currentUser.currentPoints} điểm để nâng hạng Kim Cương
            </span>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions Grid 2x2 */}
      <div className="quick-actions-section">
        <div className="quick-actions-grid">
          <button className="quick-action-btn" onClick={onNavigateToMyOrders}>
            <div className="quick-icon-box">
              <ShoppingBag size={20} color="#8C5318" />
            </div>
            <span className="quick-action-label">Đơn hàng của tôi</span>
          </button>

          <button className="quick-action-btn">
            <div className="quick-icon-box">
              <Award size={20} color="#C5974A" />
            </div>
            <span className="quick-action-label">Điểm thưởng</span>
          </button>

          <button className="quick-action-btn" onClick={onNavigateToOffers}>
            <div className="quick-icon-box">
              <Ticket size={20} color="#C7521E" />
            </div>
            <span className="quick-action-label">Voucher của tôi</span>
          </button>

          <button className="quick-action-btn">
            <div className="quick-icon-box">
              <MapPin size={20} color="#2E5A36" />
            </div>
            <span className="quick-action-label">Địa chỉ giao hàng</span>
          </button>
        </div>
      </div>

      {/* 4. Recent Orders History Preview */}
      <div className="recent-orders-section">
        <div className="section-title-row">
          <h3 className="section-title">Đơn hàng gần đây</h3>
          <span className="section-link" onClick={onNavigateToMyOrders} role="button" tabIndex={0}>
            Xem tất cả ({realTableOrders.length})
          </span>
        </div>

        {realTableOrders.length > 0 ? (
          <div className="order-cards-list">
            {realTableOrders.slice(0, 2).map((order: OrderRecord) => {
              const itemsSummary = order.items.map((it: OrderItemRecord) => `${it.productName} × ${it.quantity}`).join(', ');
              const dateStr = `${new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`;

              return (
                <div key={order.id} className="order-history-card" onClick={() => onOpenOrderDetail(order.id)}>
                  <div className="order-card-head">
                    <span className="order-code">#{order.orderNumber}</span>
                    <span className={`order-status-badge status-${order.status.toLowerCase()}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="order-card-body">
                    <span className="order-items-summary">{itemsSummary}</span>
                    <span className="order-date">{dateStr}</span>
                  </div>
                  <div className="order-card-footer">
                    <span className="order-total-price">
                      Tổng: <strong>{order.total}K</strong>
                    </span>
                    <button className="order-detail-link">Xem chi tiết →</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-orders-msg">Bàn của bạn chưa có đơn hàng nào</p>
        )}
      </div>

      {/* 5. Account Settings Menu */}
      <div className="account-menu-section">
        <div className="account-menu-group">
          <div className="menu-item">
            <div className="menu-item-left">
              <User size={18} className="menu-icon" />
              <span>Thông tin cá nhân</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <MapPin size={18} className="menu-icon" />
              <span>Sổ địa chỉ</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <CreditCard size={18} className="menu-icon" />
              <span>Phương thức thanh toán</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <Bell size={18} className="menu-icon" />
              <span>Cài đặt thông báo</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>
        </div>

        <div className="account-menu-group">
          <div className="menu-item">
            <div className="menu-item-left">
              <Globe size={18} className="menu-icon" />
              <span>Ngôn ngữ</span>
            </div>
            <span className="menu-value-tag">Tiếng Việt</span>
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <HelpCircle size={18} className="menu-icon" />
              <span>Trung tâm hỗ trợ</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>

          {/* Về ANA Chiang Mai / Về ứng dụng */}
          <div className="menu-item" onClick={() => setIsAboutModalOpen(true)} role="button" tabIndex={0}>
            <div className="menu-item-left">
              <Info size={18} className="menu-icon" />
              <span>Về ứng dụng</span>
            </div>
            <div className="menu-item-right-wrap">
              <span className="menu-value-tag">Lucky Dream</span>
              <ChevronRight size={16} className="menu-chevron" />
            </div>
          </div>

          {/* Chuyển đổi (Hidden Admin Gateway) */}
          <div className="menu-item" onClick={() => setIsAdminAuthModalOpen(true)} role="button" tabIndex={0}>
            <div className="menu-item-left">
              <ArrowLeftRight size={18} className="menu-icon" />
              <span>Chuyển đổi</span>
            </div>
            <ChevronRight size={16} className="menu-chevron" />
          </div>
        </div>

        {/* Change Table Action button */}
        <div className="logout-wrapper">
          <button className="logout-btn" onClick={handleChangeTableClick}>
            <RefreshCw size={16} />
            <span>Đổi bàn khác</span>
          </button>
        </div>

        {/* Subtle Hidden Switch Access (No Admin text, no badges, quiet icon) */}
        <div className="subtle-access-row">
          <button
            className="subtle-switch-icon-btn"
            onClick={() => setIsAdminAuthModalOpen(true)}
            aria-label="Chuyển đổi"
            title="Chuyển đổi"
          >
            <ArrowLeftRight size={13} />
          </button>
        </div>

        {/* Developer Credit Footer */}
        <DeveloperFooter onOpenModal={() => setIsAboutModalOpen(true)} />
      </div>

      {/* Confirmation Modal when changing table with non-empty cart */}
      <ChangeTableModal
        isOpen={isChangeTableModalOpen}
        onClose={() => setIsChangeTableModalOpen(false)}
        onConfirm={handleConfirmChangeTable}
        currentTableName={currentTable?.name}
      />

      {/* Full Developer & About App Modal */}
      <AboutAppModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={() => {
          setIsAdminAuthModalOpen(false);
          if (onNavigateToAdmin) {
            onNavigateToAdmin();
          }
        }}
      />
    </div>
  );
};
