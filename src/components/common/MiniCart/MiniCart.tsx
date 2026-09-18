import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import './MiniCart.css';

interface MiniCartProps {
  onCheckout?: () => void;
}

export const MiniCart: React.FC<MiniCartProps> = ({ onCheckout }) => {
  const { totalCount, totalAmount, lastAddedItem } = useCart();

  if (totalCount === 0) {
    return null;
  }

  // Display the last added item or standard item
  const displayItem = lastAddedItem?.product || {
    name: 'Trà sữa Thái đỏ',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf595c207?w=150&auto=format&fit=crop&q=80'
  };

  return (
    <div className="mini-cart-container">
      <div className="mini-cart-pill">
        {/* Left Item Thumbnail with Badge */}
        <div className="mini-cart-thumb-wrap">
          <img
            src={displayItem.image}
            alt={displayItem.name}
            className="mini-cart-thumb-img"
          />
          <span className="mini-cart-badge">{totalCount}</span>
        </div>

        {/* Middle Info */}
        <div className="mini-cart-info">
          <span className="mini-cart-title">{displayItem.name}</span>
          <span className="mini-cart-summary">
            {totalCount} món • <strong>{totalAmount}K</strong>
          </span>
        </div>

        {/* Right Checkout Button */}
        <button
          className="mini-cart-checkout-btn"
          onClick={onCheckout}
          aria-label="Thanh toán đơn hàng"
        >
          <span>Thanh toán</span>
          <ArrowRight size={15} className="checkout-arrow-icon" />
        </button>
      </div>
    </div>
  );
};
