import React, { useState } from 'react';
import { Phone, MessageCircle, Mail } from 'lucide-react';
import { AboutAppModal } from '../../modals/AboutAppModal';
import './DeveloperFooter.css';

interface DeveloperFooterProps {
  onOpenModal?: () => void;
  className?: string;
}

export const DeveloperFooter: React.FC<DeveloperFooterProps> = ({
  onOpenModal,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <footer className={`developer-global-footer ${className}`}>
        <div className="dev-footer-inner">
          <div
            className="dev-footer-main"
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            title="Xem chi tiết đơn vị phát triển Lucky Dream"
          >
            <div className="dev-footer-badge">
              <span className="dev-badge-label">NHÀ PHÁT TRIỂN</span>
              <strong className="dev-badge-company">Lucky Dream</strong>
            </div>
            <span className="dev-footer-caption">
              Built & developed by Lucky Dream
            </span>
          </div>

          <div className="dev-footer-quick-links">
            <a href="tel:0912106084" className="dev-quick-link" title="Gọi điện 0912 106 084">
              <Phone size={12} />
              <span>0912 106 084</span>
            </a>
            <span className="dev-link-separator">•</span>
            <a
              href="https://zalo.me/0912106084"
              target="_blank"
              rel="noopener noreferrer"
              className="dev-quick-link"
              title="Chat Zalo 0912 106 084"
            >
              <MessageCircle size={12} />
              <span>Zalo</span>
            </a>
            <span className="dev-link-separator">•</span>
            <a
              href="mailto:phamvantoan1944@gmail.com"
              className="dev-quick-link"
              title="Gửi Email phamvantoan1944@gmail.com"
            >
              <Mail size={12} />
              <span>Email</span>
            </a>
          </div>

          <div className="dev-footer-copyright">
            <span>© 2026 ANA CHIANG MAI. Tất cả quyền được bảo lưu.</span>
          </div>
        </div>
      </footer>

      {!onOpenModal && (
        <AboutAppModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
