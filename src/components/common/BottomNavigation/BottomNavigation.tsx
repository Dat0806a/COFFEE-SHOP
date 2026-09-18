import React from 'react';
import { Home, LayoutGrid, ShoppingCart, Percent, User } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import './BottomNavigation.css';

export type NavTab = 'home' | 'categories' | 'cart' | 'offers' | 'account';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  const { totalCount } = useCart();

  return (
    <nav className="bottom-nav-container">
      <div className="bottom-nav-inner">
        {/* Tab 1: Trang chủ */}
        <button
          className={`nav-tab-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
          aria-label="Trang chủ"
        >
          <Home size={22} className="nav-tab-icon" />
          <span className="nav-tab-label">Trang chủ</span>
          {activeTab === 'home' && <span className="nav-active-bar" />}
        </button>

        {/* Tab 2: Danh mục */}
        <button
          className={`nav-tab-item ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => onTabChange('categories')}
          aria-label="Danh mục"
        >
          <LayoutGrid size={22} className="nav-tab-icon" />
          <span className="nav-tab-label">Danh mục</span>
          {activeTab === 'categories' && <span className="nav-active-bar" />}
        </button>

        {/* Tab 3: Giỏ hàng */}
        <button
          className={`nav-tab-item ${activeTab === 'cart' ? 'active' : ''}`}
          onClick={() => onTabChange('cart')}
          aria-label="Giỏ hàng"
        >
          <div className="cart-icon-wrap">
            <ShoppingCart size={22} className="nav-tab-icon" />
            {totalCount > 0 && <span className="nav-cart-badge">{totalCount}</span>}
          </div>
          <span className="nav-tab-label">Giỏ hàng</span>
          {activeTab === 'cart' && <span className="nav-active-bar" />}
        </button>

        {/* Tab 4: Ưu đãi */}
        <button
          className={`nav-tab-item ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => onTabChange('offers')}
          aria-label="Ưu đãi"
        >
          <div className="coupon-icon-wrap">
            <div className="coupon-box">
              <Percent size={14} strokeWidth={2.5} />
            </div>
          </div>
          <span className="nav-tab-label">Ưu đãi</span>
          {activeTab === 'offers' && <span className="nav-active-bar" />}
        </button>

        {/* Tab 5: Tài khoản */}
        <button
          className={`nav-tab-item ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => onTabChange('account')}
          aria-label="Tài khoản"
        >
          <User size={22} className="nav-tab-icon" />
          <span className="nav-tab-label">Tài khoản</span>
          {activeTab === 'account' && <span className="nav-active-bar" />}
        </button>
      </div>

      {/* iOS Home Indicator Bar */}
      <div className="ios-indicator-bar-wrap">
        <div className="ios-indicator-bar" />
      </div>
    </nav>
  );
};
