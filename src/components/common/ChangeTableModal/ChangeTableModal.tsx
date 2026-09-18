import React from 'react';
import { AlertCircle } from 'lucide-react';
import './ChangeTableModal.css';

interface ChangeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentTableName?: string;
}

export const ChangeTableModal: React.FC<ChangeTableModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentTableName
}) => {
  if (!isOpen) return null;

  return (
    <div className="change-table-modal-overlay" onClick={onClose}>
      <div
        className="change-table-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="change-table-modal-icon-wrap">
          <AlertCircle size={28} className="change-table-modal-icon" />
        </div>

        <h3 className="change-table-modal-title">Bạn có chắc muốn đổi bàn?</h3>
        
        {currentTableName && (
          <p className="change-table-current-hint">
            Hiện tại: <strong>{currentTableName}</strong>
          </p>
        )}

        <p className="change-table-modal-desc">
          Giỏ hàng hiện tại có thể được xóa khi bạn đổi bàn.
        </p>

        <div className="change-table-modal-actions">
          <button
            type="button"
            className="change-table-btn cancel-btn"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="change-table-btn confirm-btn"
            onClick={onConfirm}
          >
            Đổi bàn
          </button>
        </div>
      </div>
    </div>
  );
};
