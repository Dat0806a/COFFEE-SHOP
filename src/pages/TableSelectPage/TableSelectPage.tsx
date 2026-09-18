import React from 'react';
import { useTableSession } from '../../context/TableSessionContext';
import { customerTables } from '../../data/tables';
import { Utensils, Sparkles, Coffee } from 'lucide-react';
import './TableSelectPage.css';

export const TableSelectPage: React.FC = () => {
  const { selectTable } = useTableSession();

  return (
    <div className="table-select-page">
      <div className="table-select-container">
        {/* Brand Header */}
        <div className="table-brand-header">
          <div className="table-brand-logo-icon">
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <h1 className="table-brand-title">ANA CHIANG MAI</h1>
          <div className="table-brand-subtitle">— THAI DRINK & DESSERT —</div>
          <div className="table-brand-tagline">Hương vị Thái giữa lòng Việt</div>
        </div>

        {/* Title & Instruction */}
        <div className="table-intro-section">
          <div className="table-badge-welcome">
            <Sparkles size={14} color="#C5974A" />
            <span>Chào mừng bạn đến với ANA</span>
          </div>
          <h2 className="table-main-heading">Hãy chọn số bàn của bạn</h2>
          <p className="table-sub-heading">Số bàn nằm ở trên bàn</p>
        </div>

        {/* 5 Table Cards Grid */}
        <div className="table-grid">
          {customerTables.map((table, index) => {
            const isFifth = index === 4;
            const displayNum = table.tableNumber < 10 ? `0${table.tableNumber}` : `${table.tableNumber}`;
            
            return (
              <button
                key={table.id}
                className={`table-card-btn ${isFifth ? 'table-card-fifth' : ''}`}
                onClick={() => selectTable(table.tableNumber)}
                aria-label={`Chọn ${table.name}`}
              >
                <div className="table-card-inner">
                  <div className="table-card-header">
                    <span className="table-number-digit">{displayNum}</span>
                    <div className="table-icon-wrap">
                      {table.tableNumber % 2 === 0 ? (
                        <Coffee size={16} className="table-card-icon" />
                      ) : (
                        <Utensils size={16} className="table-card-icon" />
                      )}
                    </div>
                  </div>
                  
                  <div className="table-card-bottom">
                    <span className="table-card-label">{table.name}</span>
                    <span className="table-card-action">Chạm để vào menu →</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Note */}
        <div className="table-footer-note">
          <span>❖ Vui lòng chọn đúng số bàn để quán phục vụ món chính xác nhất ❖</span>
        </div>
      </div>
    </div>
  );
};
