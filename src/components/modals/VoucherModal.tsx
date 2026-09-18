import React from 'react';
import { X, Ticket, Check } from 'lucide-react';
import { Offer } from '../../types';
import { offers } from '../../data/offers';
import './VoucherModal.css';

interface VoucherModalProps {
  isOpen: boolean;
  selectedVoucher: Offer | null;
  onSelectVoucher: (voucher: Offer | null) => void;
  onClose: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  selectedVoucher,
  onSelectVoucher,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="voucher-modal-overlay" onClick={onClose}>
      <div className="voucher-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voucher-modal-header">
          <div className="voucher-modal-title-group">
            <Ticket size={20} color="#8C5318" />
            <h3 className="voucher-modal-title">Chọn mã ưu đãi ANA</h3>
          </div>
          <button className="voucher-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Voucher List */}
        <div className="voucher-list-wrap">
          {offers
            .filter((o) => !o.isExpired)
            .map((voucher) => {
              const isSelected = selectedVoucher?.id === voucher.id;
              return (
                <div
                  key={voucher.id}
                  className={`voucher-card-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectVoucher(isSelected ? null : voucher);
                    onClose();
                  }}
                >
                  <div className="voucher-left-stub">
                    <span className="stub-discount">{voucher.title}</span>
                    <span className="stub-code">{voucher.code}</span>
                  </div>

                  <div className="voucher-center-info">
                    <h5 className="voucher-info-title">{voucher.description}</h5>
                    <span className="voucher-expiry">HSD: {voucher.expiryDate}</span>
                  </div>

                  <div className="voucher-right-action">
                    <button className={`voucher-select-btn ${isSelected ? 'active' : ''}`}>
                      {isSelected ? <Check size={14} /> : 'Áp dụng'}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
