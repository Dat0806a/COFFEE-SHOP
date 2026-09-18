import React from 'react';
import { Product } from '../../../types';
import { ProductCard } from '../ProductCard/ProductCard';
import './ProductGrid.css';

interface ProductGridProps {
  products: Product[];
  onOpenOptions?: (product: Product) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onOpenOptions }) => {
  if (products.length === 0) {
    return (
      <div className="product-grid-empty">
        <p>Không tìm thấy món phù hợp</p>
        <span>Vui lòng thử tìm kiếm hoặc chọn danh mục khác</span>
      </div>
    );
  }

  return (
    <div className="product-grid-wrapper">
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onOpenOptions={onOpenOptions}
          />
        ))}
      </div>
    </div>
  );
};
