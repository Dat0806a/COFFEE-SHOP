import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Info,
  X
} from 'lucide-react';
import '../components/common/DialogModal/DialogModal.css';

export type DialogType = 'error' | 'warning' | 'confirm' | 'success' | 'info';

export interface DialogOptions {
  type?: DialogType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface DialogContextValue {
  showDialog: (options: DialogOptions) => void;
  showError: (optionsOrMessage: string | (Omit<DialogOptions, 'type'> & { title?: string })) => void;
  showAlert: (optionsOrMessage: string | (Omit<DialogOptions, 'type'> & { title?: string })) => void;
  showWarning: (optionsOrMessage: string | (Omit<DialogOptions, 'type'> & { title?: string })) => void;
  showSuccess: (optionsOrMessage: string | (Omit<DialogOptions, 'type'> & { title?: string })) => void;
  showConfirm: (options: Omit<DialogOptions, 'type'>) => void;
  closeDialog: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<DialogOptions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const closeDialog = useCallback(() => {
    if (activeDialog?.onCancel) {
      try {
        activeDialog.onCancel();
      } catch {
        // ignore
      }
    }
    setActiveDialog(null);
    setIsProcessing(false);
  }, [activeDialog]);

  const showDialog = useCallback((options: DialogOptions) => {
    setActiveDialog(options);
    setIsProcessing(false);
  }, []);

  const showError = useCallback((param: string | (Omit<DialogOptions, 'type'> & { title?: string })) => {
    if (typeof param === 'string') {
      showDialog({
        type: 'error',
        title: 'Thông báo lỗi',
        message: param,
        confirmText: 'Đã hiểu'
      });
    } else {
      showDialog({
        type: 'error',
        title: param.title || 'Thông báo lỗi',
        confirmText: param.confirmText || 'Đã hiểu',
        ...param
      });
    }
  }, [showDialog]);

  const showAlert = useCallback((param: string | (Omit<DialogOptions, 'type'> & { title?: string })) => {
    if (typeof param === 'string') {
      showDialog({
        type: 'warning',
        title: 'Chú ý',
        message: param,
        confirmText: 'Đã hiểu'
      });
    } else {
      showDialog({
        type: 'warning',
        title: param.title || 'Chú ý',
        confirmText: param.confirmText || 'Đã hiểu',
        ...param
      });
    }
  }, [showDialog]);

  const showWarning = useCallback((param: string | (Omit<DialogOptions, 'type'> & { title?: string })) => {
    if (typeof param === 'string') {
      showDialog({
        type: 'warning',
        title: 'Cảnh báo',
        message: param,
        confirmText: 'Đã hiểu'
      });
    } else {
      showDialog({
        type: 'warning',
        title: param.title || 'Cảnh báo',
        confirmText: param.confirmText || 'Đã hiểu',
        ...param
      });
    }
  }, [showDialog]);

  const showSuccess = useCallback((param: string | (Omit<DialogOptions, 'type'> & { title?: string })) => {
    if (typeof param === 'string') {
      showDialog({
        type: 'success',
        title: 'Thành công',
        message: param,
        confirmText: 'Đồng ý'
      });
    } else {
      showDialog({
        type: 'success',
        title: param.title || 'Thành công',
        confirmText: param.confirmText || 'Đồng ý',
        ...param
      });
    }
  }, [showDialog]);

  const showConfirm = useCallback((options: Omit<DialogOptions, 'type'>) => {
    showDialog({
      type: 'confirm',
      title: options.title || 'Xác nhận thao tác',
      confirmText: options.confirmText || 'Xác nhận',
      cancelText: options.cancelText || 'Hủy bỏ',
      ...options
    });
  }, [showDialog]);

  const handleConfirm = async () => {
    if (!activeDialog) return;
    if (activeDialog.onConfirm) {
      try {
        setIsProcessing(true);
        await activeDialog.onConfirm();
      } catch (e) {
        console.error('Dialog confirm action error:', e);
      } finally {
        setIsProcessing(false);
      }
    }
    setActiveDialog(null);
  };

  const handleCancel = () => {
    closeDialog();
  };

  const renderIcon = () => {
    const type = activeDialog?.type || 'info';
    switch (type) {
      case 'error':
        return <AlertCircle size={32} strokeWidth={2.2} />;
      case 'warning':
        return <AlertTriangle size={32} strokeWidth={2.2} />;
      case 'confirm':
        return <HelpCircle size={32} strokeWidth={2.2} />;
      case 'success':
        return <CheckCircle2 size={32} strokeWidth={2.2} />;
      case 'info':
      default:
        return <Info size={32} strokeWidth={2.2} />;
    }
  };

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        showError,
        showAlert,
        showWarning,
        showSuccess,
        showConfirm,
        closeDialog
      }}
    >
      {children}

      {/* Global UI Pop Up Modal */}
      {activeDialog && (
        <div
          className="dialog-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isProcessing) {
              handleCancel();
            }
          }}
        >
          <div className="dialog-modal-card">
            {/* Close X button */}
            {!isProcessing && (
              <button
                className="dialog-close-btn"
                onClick={handleCancel}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            )}

            {/* Icon Wrap */}
            <div className={`dialog-icon-wrap type-${activeDialog.type || 'info'}`}>
              {renderIcon()}
            </div>

            {/* Title & Message */}
            <h3 className="dialog-title">{activeDialog.title || 'Thông báo'}</h3>
            <p className="dialog-message">{activeDialog.message}</p>

            {/* Action Buttons */}
            <div className={`dialog-actions ${activeDialog.type === 'confirm' ? 'double' : 'single'}`}>
              {activeDialog.type === 'confirm' && (
                <button
                  className="dialog-btn dialog-btn-cancel"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  {activeDialog.cancelText || 'Hủy bỏ'}
                </button>
              )}

              <button
                className={`dialog-btn dialog-btn-confirm ${activeDialog.isDestructive ? 'destructive' : ''}`}
                onClick={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? 'Đang xử lý...' : activeDialog.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
