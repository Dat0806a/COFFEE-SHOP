import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Coffee,
  FolderTree,
  TrendingUp,
  Volume2,
  VolumeX,
  BellRing,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ChevronLeft
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTableSession } from '../../context/TableSessionContext';
import { useStore } from '../../context/StoreContext';
import { soundService } from '../../services/soundService';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminOrdersPage } from './AdminOrdersPage';
import { AdminProductsPage } from './AdminProductsPage';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { AdminRevenuePage } from './AdminRevenuePage';
import { AdminNotificationToast } from '../../components/admin/AdminNotificationToast/AdminNotificationToast';
import { AdminNotificationCenter } from '../../components/admin/AdminNotificationCenter/AdminNotificationCenter';
import './AdminLayout.css';

export type AdminTab = 'overview' | 'orders' | 'products' | 'categories' | 'revenue';

export const AdminLayout: React.FC = () => {
  const { adminUser, logout } = useAdminAuth();
  const { clearTableSession } = useTableSession();
  const {
    newOrdersCount,
    openOrderDetail,
    adminNotifications,
    adminUnreadCount,
    markAdminNotificationRead,
    markAllAdminNotificationsRead,
    adminNotificationToasts,
    dismissAdminNotificationToast
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isAudioOn, setIsAudioOn] = useState<boolean>(() => soundService.isEnabled());
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Listen to 8s+ chime playing state to reflect active ringing in header
    const unsubscribe = soundService.onPlayStateChange((playing) => {
      setIsAudioPlaying(playing);
    });
    return unsubscribe;
  }, []);

  const toggleSound = () => {
    soundService.unlockAudio();
    if (isAudioPlaying) {
      // If currently ringing 8s chime, clicking mutes it immediately
      soundService.stopSound();
      return;
    }
    const nextState = !isAudioOn;
    setIsAudioOn(nextState);
    soundService.setEnabled(nextState);
  };

  const handleLogout = () => {
    soundService.stopSound();
    logout();
    clearTableSession();
  };

  const handleViewOrder = (orderIdOrNumber: string) => {
    // When admin answers notification, stop chime
    soundService.stopSound();
    setActiveTab('orders');
    setOrderStatusFilter('ALL');
    openOrderDetail(orderIdOrNumber);
  };

  const handleNavClick = (tab: AdminTab, filter?: string) => {
    setActiveTab(tab);
    setOrderStatusFilter(filter);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="admin-root-container">
      {/* Toast Notification Stack */}
      <AdminNotificationToast
        notifications={adminNotificationToasts}
        onDismiss={dismissAdminNotificationToast}
        onViewOrder={handleViewOrder}
      />

      {/* Sidebar Overlay on mobile */}
      {isMobileSidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. Admin Sidebar */}
      <aside className={`admin-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="brand-logo-wrap">
            <div className="brand-symbol">☕</div>
            <div className="brand-texts">
              <span className="brand-title">ANA CHIANG MAI</span>
              <span className="brand-role-badge">
                <ShieldCheck size={12} />
                <span>Tài khoản Quản trị</span>
              </span>
            </div>
          </div>

          <button
            className="mobile-close-sidebar-btn"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Đóng Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="admin-sidebar-nav">
          <button
            className={`nav-item-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleNavClick('overview')}
          >
            <LayoutDashboard size={18} />
            <span>Tổng quan</span>
          </button>

          <button
            className={`nav-item-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleNavClick('orders')}
          >
            <ShoppingBag size={18} />
            <span>Đơn hàng</span>
            {newOrdersCount > 0 && (
              <span className="nav-badge-alert">{newOrdersCount}</span>
            )}
          </button>

          <button
            className={`nav-item-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => handleNavClick('products')}
          >
            <Coffee size={18} />
            <span>Thực đơn</span>
          </button>

          <button
            className={`nav-item-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => handleNavClick('categories')}
          >
            <FolderTree size={18} />
            <span>Danh mục</span>
          </button>

          <button
            className={`nav-item-btn ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => handleNavClick('revenue')}
          >
            <TrendingUp size={18} />
            <span>Doanh thu</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-profile-badge">
            <div className="admin-avatar">A</div>
            <div className="admin-info-col">
              <span className="admin-name">{adminUser?.name || 'Quản trị viên'}</span>
              <span className="admin-email">{adminUser?.email || 'admin@anachiangmai.vn'}</span>
            </div>
          </div>

          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="admin-main-wrapper">
        {/* Top Navbar */}
        <header className="admin-top-navbar">
          <div className="top-nav-left">
            {/* Back to Overview button when in sub-screens */}
            {activeTab !== 'overview' && (
              <button
                className="admin-back-btn"
                onClick={() => handleNavClick('overview')}
                aria-label="Quay lại Tổng quan"
                title="Quay lại Tổng quan"
              >
                <ChevronLeft size={22} />
              </button>
            )}

            <button
              className="mobile-menu-trigger"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Mở Menu"
            >
              <Menu size={22} />
            </button>

            <div className="admin-header-title-box">
              <span className="admin-brand-label">ANA CHIANG MAI</span>
              <h2 className="admin-header-title">
                {activeTab === 'overview' && 'Tổng quan hoạt động'}
                {activeTab === 'orders' && 'Quản lý Đơn hàng'}
                {activeTab === 'products' && 'Quản lý Thực đơn'}
                {activeTab === 'categories' && 'Quản lý Danh mục'}
                {activeTab === 'revenue' && 'Báo cáo & Thống kê Doanh thu'}
              </h2>
            </div>
          </div>

          <div className="top-nav-right">
            {/* Notification Center */}
            <AdminNotificationCenter
              notifications={adminNotifications}
              unreadCount={adminUnreadCount}
              onMarkAsRead={markAdminNotificationRead}
              onMarkAllAsRead={markAllAdminNotificationsRead}
              onViewOrder={handleViewOrder}
            />

            {/* Audio Toggle Button */}
            <button
              className={`audio-toggle-btn ${isAudioOn ? 'on' : 'off'} ${isAudioPlaying ? 'is-playing' : ''}`}
              onClick={toggleSound}
              title={
                isAudioPlaying
                  ? 'Đang đổ chuông thông báo (>= 8s) - Bấm để tắt chuông ngay'
                  : isAudioOn
                  ? 'Âm thanh thông báo đang BẬT (kêu ~9.2s khi có đơn/hoạt động mới)'
                  : 'Âm thanh thông báo đang TẮT - Bấm để bật'
              }
            >
              {isAudioPlaying ? (
                <BellRing size={16} className="ringing-bell-icon" />
              ) : isAudioOn ? (
                <Volume2 size={16} />
              ) : (
                <VolumeX size={16} />
              )}
              <span>
                {isAudioPlaying
                  ? 'ĐANG KÊU • TẮT CHUÔNG'
                  : isAudioOn
                  ? 'Âm thanh: BẬT'
                  : 'Âm thanh: TẮT'}
              </span>
            </button>

            {/* Logout Button */}
            <button
              className="admin-header-logout-btn"
              onClick={handleLogout}
              title="Đăng xuất khỏi tài khoản Admin"
            >
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Page Content Render */}
        <div className="admin-page-body">
          {activeTab === 'overview' && (
            <AdminOverviewPage
              onNavigateToOrders={(filter) => handleNavClick('orders', filter)}
              onNavigateToRevenue={() => handleNavClick('revenue')}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersPage initialStatusFilter={orderStatusFilter} />
          )}

          {activeTab === 'products' && <AdminProductsPage />}

          {activeTab === 'categories' && <AdminCategoriesPage />}

          {activeTab === 'revenue' && <AdminRevenuePage />}
        </div>
      </main>
    </div>
  );
};
