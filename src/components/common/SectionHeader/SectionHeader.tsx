import React from 'react';
import { ArrowRight } from 'lucide-react';
import './SectionHeader.css';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  viewAllText?: string;
  onViewAll?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  viewAllText = 'Xem tất cả',
  onViewAll
}) => {
  return (
    <div className="section-header">
      <div className="section-title-wrap">
        {/* Golden Lotus / Thai Kanok Motif */}
        <div className="lotus-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2C12 2 10.5 7.5 7 10C3.5 12.5 2 16 3 19C4 22 8 22 12 22C16 22 20 22 21 19C22 16 20.5 12.5 17 10C13.5 7.5 12 2 12 2Z"
              fill="#C5974A"
              fillOpacity="0.3"
            />
            <path
              d="M12 3C12 3 10.8 8 8 10.5C5.2 13 4 16 5 18.5C6 21 9.5 21 12 21C14.5 21 18 21 19 18.5C20 16 18.8 13 16 10.5C13.2 8 12 3 12 3Z"
              stroke="#B68438"
              strokeWidth="1.5"
            />
            <path d="M12 7V19" stroke="#8C5318" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M8.5 12C9.5 14 11 16 12 18" stroke="#8C5318" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M15.5 12C14.5 14 13 16 12 18" stroke="#8C5318" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="section-title-texts">
          <h3 className="section-main-title">{title}</h3>
          {subtitle && <span className="section-sub-title">{subtitle}</span>}
        </div>
      </div>

      {onViewAll && (
        <button className="view-all-btn" onClick={onViewAll}>
          <span>{viewAllText}</span>
          <ArrowRight size={14} className="view-all-icon" />
        </button>
      )}
    </div>
  );
};
