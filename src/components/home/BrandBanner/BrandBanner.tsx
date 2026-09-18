import React from 'react';
import './BrandBanner.css';

export const BrandBanner: React.FC = () => {
  return (
    <div className="brand-banner-wrapper">
      <div className="brand-banner-card">
        {/* Background Artwork Silhouette */}
        <div className="brand-bg-pattern" />

        {/* Left Side Content */}
        <div className="brand-banner-left">
          <span className="brand-sub-tag">T H Ư Ơ N G   H I Ệ U</span>
          <h3 className="brand-headline">ANA CHIANG MAI</h3>
          <div className="brand-banner-ornament">
            <span>❖ Trong từng món uống</span>
          </div>
        </div>

        {/* Right Side Content */}
        <div className="brand-banner-right">
          <span className="brand-english-tag">
            T H A I L A N D
            <br />
            I N   A   C U P
          </span>
          <div className="brand-flower-stamp">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M14 2C15.2 6.8 21.2 8 21.2 14C21.2 20 15.2 21.2 14 26C12.8 21.2 6.8 20 6.8 14C6.8 8 12.8 6.8 14 2Z"
                fill="#C5974A"
                fillOpacity="0.5"
              />
              <circle cx="14" cy="14" r="3.5" fill="#8C5318" />
              <path
                d="M2 14C6.8 12.8 8 6.8 14 6.8C20 6.8 21.2 12.8 26 14C21.2 15.2 20 21.2 14 21.2C8 21.2 6.8 15.2 2 14Z"
                fill="#C5974A"
                fillOpacity="0.35"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
