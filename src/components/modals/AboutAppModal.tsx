import React from 'react';
import { X } from 'lucide-react';
import { DeveloperCredit } from '../common/DeveloperCredit/DeveloperCredit';
import './AboutAppModal.css';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div
        className="about-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="about-modal-close-btn"
          onClick={onClose}
          aria-label="Đóng cửa sổ"
        >
          <X size={18} />
        </button>

        <DeveloperCredit variant="full" />
      </div>
    </div>
  );
};
