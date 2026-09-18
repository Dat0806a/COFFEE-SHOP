import React from 'react';
import { Phone, MessageCircle, Mail, Sparkles, ExternalLink } from 'lucide-react';
import './DeveloperCredit.css';

export interface DeveloperCreditProps {
  variant?: 'compact' | 'full';
  onOpenAboutModal?: () => void;
}

export const DeveloperCredit: React.FC<DeveloperCreditProps> = ({
  variant = 'compact',
  onOpenAboutModal
}) => {
  if (variant === 'compact') {
    return (
      <div
        className={`developer-credit-compact ${onOpenAboutModal ? 'clickable' : ''}`}
        onClick={onOpenAboutModal}
        role={onOpenAboutModal ? 'button' : undefined}
        tabIndex={onOpenAboutModal ? 0 : undefined}
        title="Thông tin nhà phát triển Lucky Dream"
      >
        <span className="dev-prefix">Built & developed by</span>
        <strong className="dev-brand-name">Lucky Dream</strong>
      </div>
    );
  }

  return (
    <div className="developer-credit-full">
      {/* App Branding Info */}
      <div className="dev-app-header">
        <div className="dev-app-logo">
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
        <h3 className="dev-app-title">ANA CHIANG MAI</h3>
        <p className="dev-app-subtitle">— Thai Drink & Dessert —</p>
      </div>

      <div className="dev-divider" />

      {/* Developer Entity Branding */}
      <div className="dev-author-section">
        <div className="dev-badge">
          <Sparkles size={12} color="#C5974A" />
          <span>Được thiết kế & phát triển bởi</span>
        </div>
        <h4 className="dev-company-title">LUCKY DREAM</h4>
      </div>

      {/* Official Contacts List */}
      <div className="dev-contacts-card">
        <span className="dev-contacts-heading">Liên hệ nhà phát triển</span>

        <div className="dev-contacts-list">
          {/* Phone */}
          <a
            href="tel:0912106084"
            className="dev-contact-item"
            title="Gọi điện tới 0912 106 084"
          >
            <div className="dev-icon-box phone">
              <Phone size={16} />
            </div>
            <div className="dev-contact-text">
              <span className="dev-contact-label">Điện thoại</span>
              <span className="dev-contact-value">0912 106 084</span>
            </div>
            <ExternalLink size={14} className="dev-contact-arrow" />
          </a>

          {/* Zalo */}
          <a
            href="https://zalo.me/0912106084"
            target="_blank"
            rel="noopener noreferrer"
            className="dev-contact-item"
            title="Mở Zalo 0912 106 084"
          >
            <div className="dev-icon-box zalo">
              <MessageCircle size={16} />
            </div>
            <div className="dev-contact-text">
              <span className="dev-contact-label">Zalo</span>
              <span className="dev-contact-value">0912 106 084</span>
            </div>
            <ExternalLink size={14} className="dev-contact-arrow" />
          </a>

          {/* Email */}
          <a
            href="mailto:phamvantoan1944@gmail.com"
            className="dev-contact-item"
            title="Gửi email tới phamvantoan1944@gmail.com"
          >
            <div className="dev-icon-box email">
              <Mail size={16} />
            </div>
            <div className="dev-contact-text">
              <span className="dev-contact-label">Email</span>
              <span className="dev-contact-value">phamvantoan1944@gmail.com</span>
            </div>
            <ExternalLink size={14} className="dev-contact-arrow" />
          </a>
        </div>
      </div>
    </div>
  );
};
