import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import './AdminProductsPage.css';

export const AdminProductsPage: React.FC = () => {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductAvailability
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(categories[0]?.id || 'ca-phe');
  const [formPrice, setFormPrice] = useState<number>(35);
  const [formImage, setFormImage] = useState('/coffee_img/1.png');
  const [formDescription, setFormDescription] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formIsThaiSpecial, setFormIsThaiSpecial] = useState(false);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q) || false;
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const openAddModal = () => {
    setFormName('');
    setFormCategory(categories[0]?.id || 'ca-phe');
    setFormPrice(35);
    setFormImage('/coffee_img/1.png');
    setFormDescription('');
    setFormIsAvailable(true);
    setFormIsThaiSpecial(false);
    setFormIsFeatured(false);
    setFormDisplayOrder(products.length + 1);
    setIsAddModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(p.price);
    setFormImage(p.image);
    setFormDescription(p.description || '');
    setFormIsAvailable(p.isAvailable !== false);
    setFormIsThaiSpecial(p.isThaiSpecial || false);
    setFormIsFeatured(p.isFeatured || false);
    setFormDisplayOrder(p.displayOrder || 1);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice <= 0) return;

    addProduct({
      name: formName.trim(),
      category: formCategory,
      price: formPrice,
      priceFormatted: `${formPrice}K`,
      image: formImage.trim() || '/coffee_img/1.png',
      description: formDescription.trim(),
      isAvailable: formIsAvailable,
      isThaiSpecial: formIsThaiSpecial,
      isFeatured: formIsFeatured,
      displayOrder: formDisplayOrder,
      rating: 5.0,
      reviewCount: 1
    });

    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !formName.trim() || formPrice <= 0) return;

    updateProduct(editingProduct.id, {
      name: formName.trim(),
      category: formCategory,
      price: formPrice,
      priceFormatted: `${formPrice}K`,
      image: formImage.trim(),
      description: formDescription.trim(),
      isAvailable: formIsAvailable,
      isThaiSpecial: formIsThaiSpecial,
      isFeatured: formIsFeatured,
      displayOrder: formDisplayOrder
    });

    setEditingProduct(null);
  };

  const handleConfirmDelete = () => {
    if (deletingProduct) {
      deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
    }
  };

  return (
    <div className="admin-products-page">
      {/* 1. Page Header */}
      <div className="products-page-header">
        <div>
          <h1 className="admin-page-title">Quản lý Thực đơn ({products.length} món)</h1>
          <p className="admin-page-subtitle">
            Cập nhật món ăn, giá tiền, hình ảnh và trạng thái bán realtime
          </p>
        </div>

        <button className="add-product-btn" onClick={openAddModal}>
          <Plus size={16} />
          <span>Thêm món mới</span>
        </button>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="products-control-bar">
        <div className="products-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên món hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-filter-chips">
          <button
            className={`cat-chip ${selectedCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            Tất cả ({products.length})
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            return (
              <button
                key={c.id}
                className={`cat-chip ${selectedCategory === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
                <span className="cat-chip-count">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Products Table */}
      <div className="products-table-wrap">
        <table className="products-data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>STT</th>
              <th style={{ width: '80px' }}>Ảnh</th>
              <th>Tên món & Mô tả</th>
              <th>Danh mục</th>
              <th>Giá bán</th>
              <th>Đặc trưng</th>
              <th>Trạng thái bán</th>
              <th style={{ width: '110px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p, idx) => {
              const catObj = categories.find((c) => c.id === p.category);
              const isAvailable = p.isAvailable !== false;

              return (
                <tr key={p.id} className={!isAvailable ? 'row-unavailable' : ''}>
                  <td className="cell-order">{p.displayOrder || idx + 1}</td>
                  <td>
                    <img src={p.image} alt={p.name} className="product-table-thumb" />
                  </td>
                  <td>
                    <div className="prod-name-title">{p.name}</div>
                    <div className="prod-desc-sub">{p.description || 'Chưa có mô tả'}</div>
                  </td>
                  <td>
                    <span className="prod-cat-badge">
                      {catObj?.icon} {catObj?.name || p.category}
                    </span>
                  </td>
                  <td>
                    <span className="prod-price-text">{p.price}K</span>
                  </td>
                  <td>
                    <div className="prod-tags-row">
                      {p.isThaiSpecial && (
                        <span className="tag-thai">
                          <Sparkles size={11} />
                          Thai Special
                        </span>
                      )}
                      {p.isFeatured && (
                        <span className="tag-featured">
                          <Flame size={11} />
                          Nổi bật
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`status-toggle-btn ${isAvailable ? 'in-stock' : 'out-stock'}`}
                      onClick={() => toggleProductAvailability(p.id)}
                      title="Bấm để đổi trạng thái"
                    >
                      <span className="toggle-dot"></span>
                      <span>{isAvailable ? 'Đang bán' : 'Tạm hết'}</span>
                    </button>
                  </td>
                  <td>
                    <div className="table-actions-cell">
                      <button
                        className="btn-action edit"
                        onClick={() => openEditModal(p)}
                        title="Chỉnh sửa món"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="btn-action delete"
                        onClick={() => setDeletingProduct(p)}
                        title="Xóa món"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            setIsAddModalOpen(false);
            setEditingProduct(null);
          }}
        >
          <div className="admin-product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {isAddModalOpen ? 'Thêm món mới vào thực đơn' : `Chỉnh sửa: ${editingProduct?.name}`}
              </h2>
              <button
                className="admin-modal-close"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="admin-product-form"
              onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit}
            >
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Tên món (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Trà Sữa Thái Đỏ..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Danh mục món (*)</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Giá bán (nghìn VNĐ, ví dụ: 35 = 35.000đ) (*)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseInt(e.target.value, 10) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    min="1"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Đường dẫn hình ảnh (URL hoặc asset /coffee_img/...)</label>
                <input
                  type="text"
                  placeholder="/coffee_img/1.png hoặc https://..."
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Mô tả hương vị / Thành phần</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả ngắn gọn về đặc trưng món uống..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="form-checkboxes-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                  />
                  <span>Đang có hàng (Bật bán)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsThaiSpecial}
                    onChange={(e) => setFormIsThaiSpecial(e.target.checked)}
                  />
                  <span>Món đặc trưng Thái (Thai Special)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsFeatured}
                    onChange={(e) => setFormIsFeatured(e.target.checked)}
                  />
                  <span>Món nổi bật trang chủ (Featured)</span>
                </label>
              </div>

              <div className="form-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-submit-save">
                  <Check size={16} />
                  <span>Lưu món</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="admin-modal-overlay" onClick={() => setDeletingProduct(null)}>
          <div className="delete-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon-wrap">
              <AlertTriangle size={28} />
            </div>
            <h3>Xác nhận xóa món</h3>
            <p>
              Bạn có chắc chắn muốn xóa món <strong>"{deletingProduct.name}"</strong> khỏi thực đơn?
            </p>
            <div className="delete-notice">
              Lưu ý: Các đơn hàng cũ đã đặt món này vẫn được bảo toàn lịch sử snapshot giá và tên món.
            </div>

            <div className="delete-modal-actions">
              <button className="btn-cancel" onClick={() => setDeletingProduct(null)}>
                Hủy
              </button>
              <button className="btn-delete-confirm" onClick={handleConfirmDelete}>
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
