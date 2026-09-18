import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Sparkles } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/home/ProductCard/ProductCard';
import { ProductOptionModal } from '../../components/modals/ProductOptionModal';
import { MiniCart } from '../../components/common/MiniCart/MiniCart';
import { Product } from '../../types';
import './CategoriesPage.css';

interface CategoriesPageProps {
  onNavigateToCart?: () => void;
}

type SortOption = 'popular' | 'rating' | 'price-asc' | 'price-desc';

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ onNavigateToCart }) => {
  const { products, categories } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  // Category info
  const activeCategoryObj = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return categories.find((c) => c.id === selectedCategory) || null;
  }, [categories, selectedCategory]);

const removeVietnameseTones = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    const normQuery = removeVietnameseTones(searchQuery);

    let list = products.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!normQuery) return true;

      const normName = removeVietnameseTones(item.name);
      const normDesc = item.description ? removeVietnameseTones(item.description) : '';
      return normName.includes(normQuery) || normDesc.includes(normQuery);
    });

    switch (sortBy) {
      case 'rating':
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
      case 'price-asc':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'popular':
      default:
        // Keep the natural defined sequence
        break;
    }

    return list;
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="categories-page">
      {/* 1. Page Header */}
      <header className="categories-header">
        <div className="categories-header-title">
          <h1 className="page-title">Danh mục</h1>
          <span className="page-subtitle">Khám phá hương vị ANA</span>
        </div>

        {/* Streamlined Search Bar */}
        <div className="categories-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm món trong thực đơn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="categories-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>
      </header>

      {/* 2. Horizontal Category Navigation Chips */}
      <div className="category-chips-wrapper">
        <div className="category-chips-track">
          <button
            className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <span className="chip-icon">✨</span>
            <span className="chip-name">Tất cả</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span className="chip-icon">{cat.icon}</span>
              <span className="chip-name">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Category Banner & Title Header */}
      <div className="category-headline-card">
        <div className="headline-text-group">
          <h2 className="headline-category-name">
            {activeCategoryObj ? activeCategoryObj.name : 'Toàn bộ Thực đơn'}
          </h2>
          <p className="headline-category-subtitle">
            {activeCategoryObj
              ? activeCategoryObj.subtitle
              : 'Tuyển tập đồ uống & tráng miệng đặc sắc chuẩn vị Chiang Mai'}
          </p>
        </div>
        <div className="headline-badge">
          <Sparkles size={14} color="#8C5318" />
          <span>{filteredProducts.length} món</span>
        </div>
      </div>

      {/* 4. Simple Filter Chips */}
      <div className="sort-filters-bar">
        <span className="sort-label">
          <ArrowUpDown size={13} /> Sắp xếp:
        </span>
        <div className="sort-buttons-row">
          <button
            className={`sort-btn ${sortBy === 'popular' ? 'active' : ''}`}
            onClick={() => setSortBy('popular')}
          >
            Phổ biến
          </button>
          <button
            className={`sort-btn ${sortBy === 'rating' ? 'active' : ''}`}
            onClick={() => setSortBy('rating')}
          >
            Bán chạy
          </button>
          <button
            className={`sort-btn ${sortBy === 'price-asc' ? 'active' : ''}`}
            onClick={() => setSortBy('price-asc')}
          >
            Giá thấp
          </button>
          <button
            className={`sort-btn ${sortBy === 'price-desc' ? 'active' : ''}`}
            onClick={() => setSortBy('price-desc')}
          >
            Giá cao
          </button>
        </div>
      </div>

      {/* 5. Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="categories-product-grid">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenOptions={(p) => setCustomizingProduct(p)}
            />
          ))}
        </div>
      ) : (
        <div className="categories-empty-state">
          <div className="empty-icon-wrap">🍵</div>
          <h3 className="empty-title">Chưa tìm thấy món phù hợp</h3>
          <p className="empty-desc">
            Không tìm thấy kết quả nào phù hợp với yêu cầu của bạn.
          </p>
          <button
            className="empty-reset-btn"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
          >
            Xem tất cả món
          </button>
        </div>
      )}

      {/* Floating Mini Cart */}
      <MiniCart onCheckout={onNavigateToCart} />

      {/* Product Option Customizer Modal */}
      <ProductOptionModal
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
      />
    </div>
  );
};
