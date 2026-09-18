import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTableSession } from '../../../context/TableSessionContext';
import './Header.css';

interface HeaderProps {
  onNavigateToAccount?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateToAccount }) => {
  const { currentTable } = useTableSession();

  return (
    <header className="header-container">
      {/* Main App Brand & User Header */}
      <div className="main-header">
        {/* Brand Logo & Name */}
        <div className="brand-section">
          <div className="brand-logo-icon">
            {/* Thai Temple / Chedi Stupa SVG Art */}
            <svg viewBox="0 0 48 48" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 2L21 8H27L24 2Z" fill="#9B6C28" />
              <path d="M24 8L18 16H30L24 8Z" stroke="#9B6C28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 16H33L36 22H12L15 16Z" stroke="#9B6C28" strokeWidth="1.5" />
              <path d="M12 22H36V28H12V22Z" stroke="#9B6C28" strokeWidth="1.5" />
              <path d="M8 28H40L44 42H4L8 28Z" stroke="#9B6C28" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M20 42V32H28V42" stroke="#9B6C28" strokeWidth="1.5" />
              <circle cx="24" cy="25" r="1.5" fill="#9B6C28" />
              <path d="M6 34C10 32 14 34 18 34" stroke="#9B6C28" strokeWidth="1.2" />
              <path d="M30 34C34 34 38 32 42 34" stroke="#9B6C28" strokeWidth="1.2" />
            </svg>
          </div>
          <div className="brand-text">
            <h1 className="brand-title">ANA CHIANG MAI</h1>
            <div className="brand-subtitle">— THAI DRINK & DESSERT —</div>
            <div className="brand-tagline">Hương vị Thái giữa lòng Việt</div>
          </div>
        </div>

        {/* User Profile */}
        <div className="header-actions">
          <div
            className="user-profile"
            onClick={onNavigateToAccount}
            role={onNavigateToAccount ? 'button' : undefined}
            tabIndex={onNavigateToAccount ? 0 : undefined}
            onKeyDown={(e) => {
              if (onNavigateToAccount && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onNavigateToAccount();
              }
            }}
            title="Xem thông tin tài khoản"
          >
            <div className="avatar-wrapper">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                alt="User Avatar"
                className="user-avatar"
              />
            </div>
            <div className="user-info">
              <span className="user-greeting">Xin chào!</span>
              <div className="user-location">
                <span className="location-name">{currentTable ? currentTable.name : 'Bàn số 1'}</span>
                <ChevronDown size={14} className="location-chevron" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
