import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';
import './AdminCategoriesPage.css';

export const AdminCategoriesPage: React.FC = () => {
  const {
    categories,
    products,
    addCategory,
    updateCategory,
    deleteCategory
  } = useStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [warningMessage, setWarningMessage] = useState<string>('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('☕');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formImage, setFormImage] = useState('/coffee_img/1.png');
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formIsActive, setFormIsActive] = useState(true);

  const openAddModal = () => {
    setFormName('');
    setFormIcon('☕');
    setFormSubtitle('');
    setFormImage('/coffee_img/1.png');
    setFormDisplayOrder(categories.length + 1);
    setFormIsActive(true);
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Category) => {
    setEditingCategory(c);
    setFormName(c.name);
    setFormIcon(c.icon);
    setFormSubtitle(c.subtitle || '');
    setFormImage(c.image || '/coffee_img/1.png');
    setFormDisplayOrder(c.displayOrder || 1);
    setFormIsActive(c.isActive !== false);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    addCategory({
      name: formName.trim(),
      icon: formIcon.trim() || '☕',
      subtitle: formSubtitle.trim(),
      image: formImage.trim(),
      displayOrder: formDisplayOrder,
      isActive: formIsActive
    });

    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formName.trim()) return;

    updateCategory(editingCategory.id, {
      name: formName.trim(),
      icon: formIcon.trim(),
      subtitle: formSubtitle.trim(),
      image: formImage.trim(),
      displayOrder: formDisplayOrder,
      isActive: formIsActive
    });

    setEditingCategory(null);
  };

  const handleAttemptDelete = (c: Category) => {
    const attachedProducts = products.filter((p) => p.category === c.id);
    if (attachedProducts.length > 0) {
      setWarningMessage(
        `Danh mục "${c.name}" đang chứa ${attachedProducts.length} sản phẩm. Bạn cần xóa hoặc chuyển các sản phẩm sang danh mục khác trước khi xóa danh mục này.`
      );
    } else {
      setWarningMessage('');
    }
    setDeletingCategory(c);
  };

  const handleConfirmDelete = () => {
    if (deletingCategory) {
      const res = deleteCategory(deletingCategory.id);
      if (res.success) {
        setDeletingCategory(null);
        setWarningMessage('');
      } else {
        setWarningMessage(res.message || 'Không thể xóa danh mục này.');
      }
    }
  };

  return (
    <div className="admin-categories-page">
      {/* 1. Header */}
      <div className="categories-page-header">
        <div>
          <h1 className="admin-page-title">Quản lý Danh mục ({categories.length} nhóm)</h1>
          <p className="admin-page-subtitle">
            Cấu hình nhóm món, biểu tượng, thứ tự hiển thị trên ứng dụng
          </p>
        </div>

        <button className="add-cat-btn" onClick={openAddModal}>
          <Plus size={16} />
          <span>Thêm danh mục</span>
        </button>
      </div>

      {/* 2. Categories Grid Cards */}
      <div className="categories-grid-cards">
        {categories.map((c) => {
          const catProducts = products.filter((p) => p.category === c.id);
          const isActive = c.isActive !== false;

          return (
            <div key={c.id} className={`cat-admin-card ${!isActive ? 'inactive' : ''}`}>
              <div className="cat-card-top">
                <div className="cat-card-icon-frame">{c.icon}</div>
                <div className="cat-card-info">
                  <div className="cat-name-row">
                    <h3 className="cat-title">{c.name}</h3>
                    <span className="cat-order-tag">Thứ tự: {c.displayOrder || 1}</span>
                  </div>
                  <p className="cat-subtitle-desc">{c.subtitle || 'Không có mô tả phụ'}</p>
                </div>
              </div>

              <div className="cat-card-mid">
                <div className="cat-metric-pill">
                  <span>{catProducts.length} sản phẩm</span>
                </div>
                <div className={`cat-status-tag ${isActive ? 'active' : 'inactive'}`}>
                  {isActive ? 'Đang kích hoạt' : 'Tạm ẩn'}
                </div>
              </div>

              <div className="cat-card-actions">
                <button
                  className="cat-btn-action edit"
                  onClick={() => openEditModal(c)}
                >
                  <Edit2 size={14} />
                  <span>Sửa</span>
                </button>
                <button
                  className="cat-btn-action delete"
                  onClick={() => handleAttemptDelete(c)}
                >
                  <Trash2 size={14} />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Add / Edit Modal */}
      {(isAddModalOpen || editingCategory) && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            setIsAddModalOpen(false);
            setEditingCategory(null);
          }}
        >
          <div className="admin-cat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {isAddModalOpen ? 'Thêm danh mục mới' : `Sửa danh mục: ${editingCategory?.name}`}
              </h2>
              <button
                className="admin-modal-close"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCategory(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="admin-cat-form"
              onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit}
            >
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Tên danh mục (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Trà trái cây, Cà phê..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Biểu tượng Emoji</label>
                  <input
                    type="text"
                    placeholder="☕, 🧋, 🍵, 🥭, 🥤..."
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    min="1"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value, 10) || 1)}
                  />
                </div>

                <div className="form-group">
                  <label>Ảnh đại diện (URL / Asset)</label>
                  <input
                    type="text"
                    placeholder="/coffee_img/1.png"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả phụ (Slogan nhỏ)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đậm vị trà, thơm béo kiểu Thái..."
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                />
              </div>

              <label className="checkbox-label" style={{ marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span>Kích hoạt danh mục này (hiển thị trên thực đơn)</span>
              </label>

              <div className="form-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCategory(null);
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit-save">
                  <Check size={16} />
                  <span>Lưu danh mục</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="admin-modal-overlay" onClick={() => setDeletingCategory(null)}>
          <div className="delete-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon-wrap">
              <AlertTriangle size={28} />
            </div>
            <h3>Xác nhận xóa danh mục</h3>
            <p>
              Bạn đang chọn xóa danh mục <strong>"{deletingCategory.name}"</strong>.
            </p>

            {warningMessage ? (
              <div className="delete-warning-banner">
                <AlertTriangle size={16} />
                <span>{warningMessage}</span>
              </div>
            ) : (
              <p className="delete-sub-text">Hành động này sẽ loại bỏ danh mục này khỏi danh sách.</p>
            )}

            <div className="delete-modal-actions">
              <button className="btn-cancel" onClick={() => setDeletingCategory(null)}>
                Đóng
              </button>
              {!warningMessage && (
                <button className="btn-delete-confirm" onClick={handleConfirmDelete}>
                  Xác nhận xóa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
