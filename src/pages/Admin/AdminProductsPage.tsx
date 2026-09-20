import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  Flame,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import './AdminProductsPage.css';

const DEFAULT_PRODUCT_IMAGE = '/coffee_img/1.png';

export const AdminProductsPage: React.FC = () => {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductAvailability,
    uploadProductImage,
    deleteProductImage
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
  const [formImage, setFormImage] = useState(DEFAULT_PRODUCT_IMAGE);
  const [formDescription, setFormDescription] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formIsThaiSpecial, setFormIsThaiSpecial] = useState(false);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(DEFAULT_PRODUCT_IMAGE);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup blob URL on unmount or previewUrl change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const closeModal = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setIsAddModalOpen(false);
    setEditingProduct(null);
    setImageFile(null);
    setImageError('');
    setIsUploadingImage(false);
    setRemoveCurrentImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openAddModal = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setFormName('');
    setFormCategory(categories[0]?.id || 'ca-phe');
    setFormPrice(35);
    setFormImage(DEFAULT_PRODUCT_IMAGE);
    setPreviewUrl(DEFAULT_PRODUCT_IMAGE);
    setImageFile(null);
    setRemoveCurrentImage(false);
    setImageError('');
    setIsUploadingImage(false);
    setFormDescription('');
    setFormIsAvailable(true);
    setFormIsThaiSpecial(false);
    setFormIsFeatured(false);
    setFormDisplayOrder(products.length + 1);
    setIsAddModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(p.price);
    const initialImg = p.image || DEFAULT_PRODUCT_IMAGE;
    setFormImage(initialImg);
    setPreviewUrl(initialImg);
    setImageFile(null);
    setRemoveCurrentImage(false);
    setImageError('');
    setIsUploadingImage(false);
    setFormDescription(p.description || '');
    setFormIsAvailable(p.isAvailable !== false);
    setFormIsThaiSpecial(p.isThaiSpecial || false);
    setFormIsFeatured(p.isFeatured || false);
    setFormDisplayOrder(p.displayOrder || 1);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setImageError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
      if (e.target) e.target.value = '';
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError('Ảnh không được lớn hơn 5MB');
      if (e.target) e.target.value = '';
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setImageFile(file);
    setPreviewUrl(objectUrl);
    setRemoveCurrentImage(false);
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(null);
    setPreviewUrl(DEFAULT_PRODUCT_IMAGE);
    setRemoveCurrentImage(true);
    setImageError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice <= 0 || isUploadingImage) return;

    let finalImageUrl = DEFAULT_PRODUCT_IMAGE;

    if (imageFile) {
      try {
        setIsUploadingImage(true);
        setImageError('');
        finalImageUrl = await uploadProductImage(imageFile);
      } catch (err: any) {
        setIsUploadingImage(false);
        setImageError(err.message || 'Lỗi khi tải ảnh lên. Vui lòng thử lại.');
        return;
      }
    } else if (!removeCurrentImage && formImage) {
      finalImageUrl = formImage.trim() || DEFAULT_PRODUCT_IMAGE;
    }

    addProduct({
      name: formName.trim(),
      category: formCategory,
      price: formPrice,
      priceFormatted: `${formPrice}K`,
      image: finalImageUrl,
      description: formDescription.trim(),
      isAvailable: formIsAvailable,
      isThaiSpecial: formIsThaiSpecial,
      isFeatured: formIsFeatured,
      displayOrder: formDisplayOrder,
      rating: 5.0,
      reviewCount: 1
    });

    closeModal();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !formName.trim() || formPrice <= 0 || isUploadingImage) return;

    let finalImageUrl = editingProduct.image;
    let oldImageToDelete: string | null = null;

    if (removeCurrentImage) {
      finalImageUrl = DEFAULT_PRODUCT_IMAGE;
      if (editingProduct.image && editingProduct.image !== DEFAULT_PRODUCT_IMAGE) {
        oldImageToDelete = editingProduct.image;
      }
    } else if (imageFile) {
      try {
        setIsUploadingImage(true);
        setImageError('');
        const newUrl = await uploadProductImage(imageFile);
        finalImageUrl = newUrl;
        if (editingProduct.image && editingProduct.image !== DEFAULT_PRODUCT_IMAGE) {
          oldImageToDelete = editingProduct.image;
        }
      } catch (err: any) {
        setIsUploadingImage(false);
        setImageError(err.message || 'Lỗi khi tải ảnh lên. Vui lòng thử lại.');
        return;
      }
    }

    updateProduct(editingProduct.id, {
      name: formName.trim(),
      category: formCategory,
      price: formPrice,
      priceFormatted: `${formPrice}K`,
      image: finalImageUrl,
      description: formDescription.trim(),
      isAvailable: formIsAvailable,
      isThaiSpecial: formIsThaiSpecial,
      isFeatured: formIsFeatured,
      displayOrder: formDisplayOrder
    });

    // Clean up old image from storage if replaced and different
    if (oldImageToDelete && oldImageToDelete !== finalImageUrl) {
      deleteProductImage(oldImageToDelete).catch(() => {});
    }

    closeModal();
  };

  const handleConfirmDelete = () => {
    if (deletingProduct) {
      const imgToDelete = deletingProduct.image;
      deleteProduct(deletingProduct.id);
      if (imgToDelete && imgToDelete !== DEFAULT_PRODUCT_IMAGE) {
        deleteProductImage(imgToDelete).catch(() => {});
      }
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
                    <img
                      src={p.image}
                      alt={p.name}
                      className="product-table-thumb"
                      onError={(e) => {
                        if (e.currentTarget.src.endsWith('/coffee_img/1.png')) return;
                        e.currentTarget.src = '/coffee_img/1.png';
                      }}
                    />
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
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {isAddModalOpen ? 'Thêm món mới vào thực đơn' : `Chỉnh sửa: ${editingProduct?.name}`}
              </h2>
              <button
                className="admin-modal-close"
                onClick={closeModal}
                disabled={isUploadingImage}
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
                    disabled={isUploadingImage}
                  />
                </div>

                <div className="form-group">
                  <label>Danh mục món (*)</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    disabled={isUploadingImage}
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
                    disabled={isUploadingImage}
                  />
                </div>

                <div className="form-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    min="1"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value, 10) || 1)}
                    disabled={isUploadingImage}
                  />
                </div>
              </div>

              {/* Image Uploader & Preview Section */}
              <div className="form-group product-image-uploader-group">
                <label>Hình ảnh món</label>
                <div className="image-uploader-card">
                  <div className="image-preview-wrapper">
                    <img
                      src={previewUrl || DEFAULT_PRODUCT_IMAGE}
                      alt="Preview món"
                      className="product-modal-preview-img"
                      onError={(e) => {
                        if (e.currentTarget.src.endsWith('/coffee_img/1.png')) return;
                        e.currentTarget.src = '/coffee_img/1.png';
                      }}
                    />
                    {previewUrl === DEFAULT_PRODUCT_IMAGE && !imageFile && (
                      <span className="default-badge">Ảnh mặc định</span>
                    )}
                  </div>

                  <div className="image-uploader-controls">
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="product-image-file-input"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                      disabled={isUploadingImage}
                    />

                    <div className="image-actions-row">
                      <button
                        type="button"
                        className="btn-upload-image"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                      >
                        <Upload size={15} />
                        <span>
                          {imageFile || (previewUrl && previewUrl !== DEFAULT_PRODUCT_IMAGE)
                            ? 'Thay ảnh khác'
                            : 'Chọn ảnh từ máy'}
                        </span>
                      </button>

                      {(imageFile || previewUrl !== DEFAULT_PRODUCT_IMAGE) && (
                        <button
                          type="button"
                          className="btn-remove-image"
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage}
                          title="Xóa ảnh và dùng ảnh mặc định"
                        >
                          <Trash2 size={14} />
                          <span>Dùng mặc định</span>
                        </button>
                      )}
                    </div>

                    <p className="image-format-note">
                      Hỗ trợ: JPG, PNG, WebP (Tối đa 5MB).
                    </p>
                  </div>
                </div>

                {imageError && (
                  <div className="image-upload-error-msg">
                    <AlertTriangle size={13} />
                    <span>{imageError}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Mô tả hương vị / Thành phần</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả ngắn gọn về đặc trưng món uống..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={isUploadingImage}
                />
              </div>

              <div className="form-checkboxes-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                    disabled={isUploadingImage}
                  />
                  <span>Đang có hàng (Bật bán)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsThaiSpecial}
                    onChange={(e) => setFormIsThaiSpecial(e.target.checked)}
                    disabled={isUploadingImage}
                  />
                  <span>Món đặc trưng Thái (Thai Special)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsFeatured}
                    onChange={(e) => setFormIsFeatured(e.target.checked)}
                    disabled={isUploadingImage}
                  />
                  <span>Món nổi bật trang chủ (Featured)</span>
                </label>
              </div>

              <div className="form-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                  disabled={isUploadingImage}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-submit-save"
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <>
                      <span className="btn-spinner"></span>
                      <span>Đang tải ảnh...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Lưu món</span>
                    </>
                  )}
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
