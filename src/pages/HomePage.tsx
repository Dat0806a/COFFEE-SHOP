import React, { useState, useMemo } from 'react';
import { Header } from '../components/common/Header/Header';
import { SearchBar } from '../components/common/SearchBar/SearchBar';
import { HeroBanner } from '../components/home/HeroBanner/HeroBanner';
import { CategoryScroller } from '../components/home/CategoryScroller/CategoryScroller';
import { SectionHeader } from '../components/common/SectionHeader/SectionHeader';
import { ProductGrid } from '../components/home/ProductGrid/ProductGrid';
import { BrandBanner } from '../components/home/BrandBanner/BrandBanner';
import { MiniCart } from '../components/common/MiniCart/MiniCart';
import { ProductOptionModal } from '../components/modals/ProductOptionModal';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { ArrowRight } from 'lucide-react';
import './HomePage.css';

interface HomePageProps {
  onNavigateToCart?: () => void;
  onNavigateToCategories?: (categoryId?: string) => void;
  onNavigateToAccount?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToCart,
  onNavigateToCategories,
  onNavigateToAccount
}) => {
  const { products, categories } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    const removeVietnameseTones = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

    const normQuery = removeVietnameseTones(searchQuery);

    return products.filter((product) => {
      const matchCategory = !selectedCategory || product.category === selectedCategory;
      if (!matchCategory) return false;
      if (!normQuery) return true;

      const normName = removeVietnameseTones(product.name);
      const normDesc = product.description ? removeVietnameseTones(product.description) : '';
      return normName.includes(normQuery) || normDesc.includes(normQuery);
    });
  }, [products, searchQuery, selectedCategory]);

  // Is Home in default Featured view mode (no search, no category filter)
  const isFeaturedView = !selectedCategory && !searchQuery.trim();

  // Curated 10 most popular signature items for featured view
  const featuredProducts = useMemo(() => {
    const populars = products.filter((p) => p.isPopular || p.isFeatured);
    const others = products.filter((p) => !p.isPopular && !p.isFeatured);
    return [...populars, ...others].slice(0, 10);
  }, [products]);

  // Products to display on home screen
  const displayedProducts = useMemo(() => {
    if (isFeaturedView) {
      return featuredProducts;
    }
    return filteredProducts;
  }, [isFeaturedView, featuredProducts, filteredProducts]);

  const handleHeroOrder = () => {
    const xoiXoai = products.find((p) => p.id === 'xoi-xoai') || products.find((p) => p.id === 'khao-niao-mamuang-xoi-xoai-thai') || products[0];
    setCustomizingProduct(xoiXoai);
  };

  const handleViewAll = () => {
    if (onNavigateToCategories) {
      onNavigateToCategories();
    } else {
      setSelectedCategory(null);
      setSearchQuery('');
    }
  };

  return (
    <div className="home-page-container">
      {/* 1. App Header */}
      <Header onNavigateToAccount={onNavigateToAccount} />

      {/* 2. Search Bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* 3. Hero Promo Banner Carousel */}
      <HeroBanner onOrderNow={handleHeroOrder} />

      {/* 4. Category Horizontal Scroller */}
      <CategoryScroller
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 5. Featured Section Header */}
      <SectionHeader
        title={selectedCategory ? 'Danh sách món' : 'Món nổi bật'}
        subtitle={selectedCategory ? `${filteredProducts.length} món` : 'Top 10 hương vị được yêu thích nhất'}
        onViewAll={handleViewAll}
      />

      {/* 6. Product 2-Column Grid (10 items on Featured view) */}
      <ProductGrid
        products={displayedProducts}
        onOpenOptions={(product) => setCustomizingProduct(product)}
      />

      {/* 6b. View all CTA button when in Featured mode */}
      {isFeaturedView && (
        <div className="home-view-all-wrapper">
          <button className="home-view-all-btn" onClick={handleViewAll}>
            <span>Xem tất cả thực đơn ({products.length} món)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* 7. Secondary Brand Story Banner (ANA CHIANG MAI) */}
      <BrandBanner />

      {/* 8. Floating Sticky Mini-Cart */}
      <MiniCart onCheckout={onNavigateToCart} />

      {/* Product Customization Modal */}
      <ProductOptionModal
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
      />
    </div>
  );
};
