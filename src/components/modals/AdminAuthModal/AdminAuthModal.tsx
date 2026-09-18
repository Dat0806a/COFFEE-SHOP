import React, { useState } from 'react';
import { X, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { soundService } from '../../../services/soundService';
import './AdminAuthModal.css';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { login, isLoading } = useAdminAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin xác thực');
      return;
    }

    setErrorMessage('');
    
    // Unlock browser audio context on user interaction safely
    try {
      soundService.unlockAudio();
    } catch {
      // ignore
    }

    try {
      const res = await login(identifier, password);
      if (res.success) {
        setIdentifier('');
        setPassword('');
        setErrorMessage('');
        onSuccess();
      } else {
        setErrorMessage(res.error || 'Thông tin xác thực không chính xác.');
      }
    } catch (err: unknown) {
      console.error('Submit login error:', err);
      setErrorMessage('Có lỗi xảy ra khi xác thực. Vui lòng thử lại.');
    }
  };

  return (
    <div className="admin-auth-overlay" onClick={onClose}>
      <div className="admin-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>

        <div className="auth-brand-header">
          <div className="auth-brand-badge">ANA CHIANG MAI</div>
          <h2 className="auth-title">Xác thực hệ thống</h2>
          <p className="auth-subtitle">Vui lòng cung cấp thông tin để tiếp tục</p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner">
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-label" htmlFor="admin-id">
              Tài khoản / Email
            </label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input
                id="admin-id"
                type="text"
                className="auth-input"
                placeholder="Tài khoản hoặc email..."
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="admin-pass">
              Mật khẩu
            </label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="admin-pass"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="auth-spinner" />
                <span>Đang kiểm tra...</span>
              </>
            ) : (
              <span>Tiếp tục</span>
            )}
          </button>

          <div className="auth-credential-hint">
            <span>Tài khoản: <strong>admin</strong> &bull; Mật khẩu: <strong>admin123</strong></span>
          </div>
        </form>
      </div>
    </div>
  );
};
