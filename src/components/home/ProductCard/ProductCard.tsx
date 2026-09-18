import React from 'react';
import { Heart, Plus, Star } from 'lucide-react';
import { Product } from '../../../types';
import { useCart } from '../../../context/CartContext';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onOpenOptions?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenOptions }) => {
  const { addToCart, toggleFavorite, isFavorite } = useCart();
  const favorite = isFavorite(product.id);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenOptions) {
      onOpenOptions(product);
    } else {
      addToCart(product, 1);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  };

  return (
    <div className="product-card" onClick={() => onOpenOptions?.(product)}>
      {/* Product Image Frame */}
      <div className="product-image-container">
        {product.badge && (
          <span className="product-badge">{product.badge}</span>
        )}
        <img
          src={product.image}
          alt={product.name}
          className="product-thumbnail"
          loading="lazy"
        />
        {/* Heart Favorite Button */}
        <button
          className={`favorite-btn ${favorite ? 'favorited' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={favorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        >
          <Heart
            size={18}
            className="favorite-heart-icon"
            fill={favorite ? '#E53935' : 'none'}
            color={favorite ? '#E53935' : '#4A3E34'}
          />
        </button>
      </div>

      {/* Product Details */}
      <div className="product-body">
        <h4 className="product-name">{product.name}</h4>

        {/* Rating & Review count */}
        <div className="product-rating-row">
          <Star size={13} className="star-icon" fill="#F5A623" color="#F5A623" />
          <span className="rating-score">{product.rating.toFixed(1)}</span>
          <span className="review-count">({product.reviewCount})</span>
        </div>

        {/* Price & Add to Cart Button */}
        <div className="product-bottom-row">
          <span className="product-price">{product.priceFormatted}</span>
          <button
            className="add-cart-btn"
            onClick={handleAddClick}
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
          >
            <Plus size={16} strokeWidth={2.8} className="add-plus-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};
