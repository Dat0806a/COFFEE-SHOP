import React, { useState } from 'react';
import { AboutAppModal } from '../../modals/AboutAppModal';
import './DeveloperBanner.css';

interface DeveloperBannerProps {
  onOpenModal?: () => void;
  className?: string;
}

export const DeveloperBanner: React.FC<DeveloperBannerProps> = ({
  onOpenModal,
  className = ''
}) => {
  const [internalModalOpen, setInternalModalOpen] = useState(false);

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setInternalModalOpen(true);
    }
  };

  return (
    <>
      <footer className={`developer-footer-container ${className}`}>
        <div
          className="dev-banner-card"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          title="Xem thông tin nhà phát triển Lucky Dream"
        >
          {/* Background Artwork Silhouette Pattern */}
          <div className="dev-bg-pattern" />

          {/* Left Side Content */}
          <div className="dev-banner-left">
            <span className="dev-sub-tag">N H À   P H Á T   T R I Ể N</span>
            <h4 className="dev-headline">Lucky Dream</h4>
            <div className="dev-banner-ornament">
              <span>❖</span>
            </div>
          </div>

          {/* Right Side Content */}
          <div className="dev-banner-right">
            <span className="dev-english-tag">
              L U C K Y   D R E A M
              <br />
              0 9 1 2   1 0 6   0 8 4
            </span>
            <div className="dev-flower-stamp">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C13 6 18 7 18 12C18 17 13 18 12 22C11 18 6 17 6 12C6 7 11 6 12 2Z"
                  fill="#C5974A"
                  fillOpacity="0.4"
                />
                <circle cx="12" cy="12" r="3" fill="#9B6C28" />
                <path
                  d="M2 12C6 11 7 6 12 6C17 6 18 11 22 12C18 13 17 18 12 18C7 18 6 13 2 12Z"
                  fill="#C5974A"
                  fillOpacity="0.25"
                />
              </svg>
            </div>
          </div>
        </div>
      </footer>

      {/* Internal modal if no external modal handler passed */}
      {!onOpenModal && (
        <AboutAppModal
          isOpen={internalModalOpen}
          onClose={() => setInternalModalOpen(false)}
        />
      )}
    </>
  );
};
