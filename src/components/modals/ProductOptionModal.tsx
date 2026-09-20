import React, { useState } from 'react';
import { X, Plus, Minus, Star, Heart } from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import './ProductOptionModal.css';

interface ProductOptionModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductOptionModal: React.FC<ProductOptionModalProps> = ({
  product,
  onClose
}) => {
  const { addToCart, toggleFavorite, isFavorite } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<'M' | 'L'>('M');
  const [sugarLevel, setSugarLevel] = useState<'30%' | '50%' | '100%'>('100%');
  const [iceLevel, setIceLevel] = useState<'0%' | '50%' | '100%'>('100%');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);

  if (!product) return null;

  const favorite = isFavorite(product.id);

  const sizePrice = selectedSize === 'L' ? 8 : 0;
  const toppingsPrice = selectedToppings.length * 10;
  const unitPrice = product.price + sizePrice + toppingsPrice;
  const totalPrice = unitPrice * quantity;

  const handleToggleTopping = (topping: string) => {
    setSelectedToppings(prev =>
      prev.includes(topping) ? prev.filter(t => t !== topping) : [...prev, topping]
    );
  };

  const handleAddToCart = () => {
    addToCart(
      {
        ...product,
        price: unitPrice,
        priceFormatted: `${unitPrice}K`
      },
      quantity
    );
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        {/* Modal Header Image */}
        <div className="modal-image-wrap">
          <img
            src={product.image}
            alt={product.name}
            className="modal-product-img"
            onError={(e) => {
              if (e.currentTarget.src.endsWith('/coffee_img/1.png')) return;
              e.currentTarget.src = '/coffee_img/1.png';
            }}
          />
          <button
            className={`modal-fav-btn ${favorite ? 'favorited' : ''}`}
            onClick={() => toggleFavorite(product.id)}
            aria-label="Yêu thích"
          >
            <Heart
              size={20}
              fill={favorite ? '#E53935' : 'none'}
              color={favorite ? '#E53935' : '#FFFFFF'}
            />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          <div className="modal-title-row">
            <div>
              <h3 className="modal-product-title">{product.name}</h3>
              <div className="modal-rating-row">
                <Star size={14} fill="#F5A623" color="#F5A623" />
                <span className="modal-rating-val">{product.rating.toFixed(1)}</span>
                <span className="modal-review-val">({product.reviewCount} đánh giá)</span>
              </div>
            </div>
            <div className="modal-unit-price">{product.priceFormatted}</div>
          </div>

          {product.description && (
            <p className="modal-description">{product.description}</p>
          )}

          {/* Size Selection */}
          <div className="option-section">
            <h5 className="option-title">Chọn kích cỡ (Size)</h5>
            <div className="option-pills">
              <button
                className={`option-pill ${selectedSize === 'M' ? 'selected' : ''}`}
                onClick={() => setSelectedSize('M')}
              >
                Size M (Vừa)
              </button>
              <button
                className={`option-pill ${selectedSize === 'L' ? 'selected' : ''}`}
                onClick={() => setSelectedSize('L')}
              >
                Size L (Lớn +8K)
              </button>
            </div>
          </div>

          {/* Sugar & Ice */}
          {product.category !== 'xoi' && product.category !== 'xoi-che' && (
            <>
              <div className="option-section">
                <h5 className="option-title">Độ ngọt (Đường)</h5>
                <div className="option-pills">
                  {(['30%', '50%', '100%'] as const).map(sugar => (
                    <button
                      key={sugar}
                      className={`option-pill ${sugarLevel === sugar ? 'selected' : ''}`}
                      onClick={() => setSugarLevel(sugar)}
                    >
                      {sugar} Đường
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-section">
                <h5 className="option-title">Lượng đá</h5>
                <div className="option-pills">
                  {(['0%', '50%', '100%'] as const).map(ice => (
                    <button
                      key={ice}
                      className={`option-pill ${iceLevel === ice ? 'selected' : ''}`}
                      onClick={() => setIceLevel(ice)}
                    >
                      {ice === '0%' ? 'Không đá' : `${ice} Đá`}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Toppings */}
          <div className="option-section">
            <h5 className="option-title">Topping thêm (+10K/món)</h5>
            <div className="toppings-list">
              {[
                { id: 't-1', name: 'Trân châu hoàng kim' },
                { id: 't-2', name: 'Thạch củ năng Thái' },
                { id: 't-3', name: 'Sương sáo Chiang Mai' },
                { id: 't-4', name: 'Kem cheese béo ngậy' }
              ].map(topping => (
                <label key={topping.id} className="topping-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedToppings.includes(topping.name)}
                    onChange={() => handleToggleTopping(topping.name)}
                  />
                  <span>{topping.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="modal-footer">
          <div className="quantity-counter">
            <button
              className="qty-btn"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              aria-label="Giảm"
            >
              <Minus size={16} />
            </button>
            <span className="qty-val">{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => setQuantity(quantity + 1)}
              aria-label="Tăng"
            >
              <Plus size={16} />
            </button>
          </div>

          <button className="modal-add-btn" onClick={handleAddToCart}>
            <span>Thêm vào giỏ • {totalPrice}K</span>
          </button>
        </div>
      </div>
    </div>
  );
};
