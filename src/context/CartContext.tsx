import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product, CartItem, Offer, OrderRecord, OrderItemRecord } from '../types';
import { offers } from '../data/offers';
import { useTableSession } from './TableSessionContext';

interface CartContextType {
  cartItems: CartItem[];
  totalCount: number;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalTotal: number;
  lastAddedItem: CartItem | null;
  addToCart: (product: Product, quantity?: number, options?: Partial<CartItem>) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: (customTableKey?: number) => void;
  favorites: Set<string>;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  
  // Vouchers & Notes
  appliedVoucher: Offer | null;
  applyVoucher: (offer: Offer | null) => void;
  orderNote: string;
  setOrderNote: (note: string) => void;
  savedOfferIds: Set<string>;
  toggleSaveOffer: (offerId: string) => void;
  isOfferSaved: (offerId: string) => boolean;
  loadOrderIntoCart: (order: OrderRecord, allProducts: Product[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTable, orderSessionId } = useTableSession();
  const tableKey = currentTable ? currentTable.tableNumber : 0;
  const loadedSessionIdRef = useRef<string | null>(orderSessionId);

  // Cart items are strictly bound to current orderSessionId
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (!orderSessionId) return [];
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved = sessionStorage.getItem(`ana_cart_session_${orderSessionId}`);
        if (saved) return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ana_user_fav`);
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set();
  });

  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<Offer | null>(offers[0]);
  const [orderNote, setOrderNote] = useState<string>('');
  const [savedOfferIds, setSavedOfferIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ana_user_saved_offers`);
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set(['off-1', 'off-4']);
  });

  // Reload/reset cart state whenever orderSessionId changes
  useEffect(() => {
    loadedSessionIdRef.current = orderSessionId;

    if (!orderSessionId) {
      setCartItems([]);
      setLastAddedItem(null);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const savedCart = sessionStorage.getItem(`ana_cart_session_${orderSessionId}`);
        setCartItems(savedCart ? JSON.parse(savedCart) : []);
      }
      setLastAddedItem(null);
    } catch {
      // ignore
    }
  }, [orderSessionId]);

  // Persist cartItems ONLY if active session matches current orderSessionId
  useEffect(() => {
    if (orderSessionId && loadedSessionIdRef.current === orderSessionId) {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem(`ana_cart_session_${orderSessionId}`, JSON.stringify(cartItems));
        }
      } catch {
        // ignore
      }
    }
  }, [cartItems, orderSessionId]);

  // Persist favorites
  useEffect(() => {
    try {
      localStorage.setItem(`ana_user_fav`, JSON.stringify(Array.from(favorites)));
    } catch {
      // ignore
    }
  }, [favorites]);

  // Persist savedOfferIds
  useEffect(() => {
    try {
      localStorage.setItem(`ana_user_saved_offers`, JSON.stringify(Array.from(savedOfferIds)));
    } catch {
      // ignore
    }
  }, [savedOfferIds]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

  // Service fee is removed (0)
  const shippingFee = 0;
  
  let discountAmount = 0;
  if (appliedVoucher && totalCount > 0) {
    if (appliedVoucher.discountType === 'fixed') {
      discountAmount = appliedVoucher.discountAmount;
    } else if (appliedVoucher.discountType === 'percent') {
      discountAmount = Math.round((totalAmount * appliedVoucher.discountAmount) / 100);
    } else if (appliedVoucher.discountType === 'freeship') {
      discountAmount = 0;
    } else if (appliedVoucher.discountType === 'combo') {
      discountAmount = appliedVoucher.discountAmount;
    }
  }

  const finalTotal = Math.max(0, totalAmount - discountAmount);

  const addToCart = (product: Product, quantity = 1, options: Partial<CartItem> = {}) => {
    const targetSize = options.selectedSize || 'M';
    const targetSugar = options.sugarLevel || '100%';
    const targetIce = options.iceLevel || '100%';
    const targetToppings = (options.toppings || []).slice().sort().join(',');
    const unitPrice = options.totalPrice ? options.totalPrice / quantity : product.price;

    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => {
        const itemToppings = (item.toppings || []).slice().sort().join(',');
        return (
          item.product.id === product.id &&
          (item.selectedSize || 'M') === targetSize &&
          (item.sugarLevel || '100%') === targetSugar &&
          (item.iceLevel || '100%') === targetIce &&
          itemToppings === targetToppings
        );
      });

      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: item.quantity + quantity,
                totalPrice: (item.quantity + quantity) * (item.totalPrice / item.quantity)
              }
            : item
        );
      }

      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product,
          quantity,
          selectedSize: targetSize,
          sugarLevel: targetSugar,
          iceLevel: targetIce,
          toppings: options.toppings || [],
          totalPrice: unitPrice * quantity
        }
      ];
    });

    setLastAddedItem({
      product,
      quantity,
      totalPrice: product.price * quantity
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId && item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.product.id === productId || item.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const unitPrice = item.totalPrice / item.quantity;
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * unitPrice
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = (customTableKey?: unknown) => {
    const key = typeof customTableKey === 'number' ? customTableKey : tableKey;
    setCartItems([]);
    setLastAddedItem(null);
    setAppliedVoucher(null);
    if (orderSessionId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`ana_cart_session_${orderSessionId}`);
      } catch {
        // ignore
      }
    }
    if (key) {
      try {
        localStorage.removeItem(`ana_cart_table_${key}`);
      } catch {
        // ignore
      }
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const isFavorite = (productId: string) => favorites.has(productId);

  const applyVoucher = (offer: Offer | null) => {
    setAppliedVoucher(offer);
  };

  const toggleSaveOffer = (offerId: string) => {
    setSavedOfferIds(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });
  };

  const loadOrderIntoCart = (order: OrderRecord, allProducts: Product[]) => {
    const loadedItems: CartItem[] = order.items.map((it: OrderItemRecord, idx: number) => {
      const prod = allProducts.find(p => p.id === it.productId) || {
        id: it.productId,
        name: it.productName,
        price: it.unitPrice,
        priceFormatted: `${it.unitPrice}K`,
        image: it.image || '/coffee_img/1.png',
        category: 'coffee',
        rating: 5,
        reviewCount: 0
      };

      return {
        id: it.id || `edit-item-${idx}`,
        product: prod,
        quantity: it.quantity,
        selectedSize: it.selectedSize || 'M',
        sugarLevel: it.sugarLevel || '100%',
        iceLevel: it.iceLevel || '100%',
        toppings: it.toppings || [],
        totalPrice: it.totalPrice
      };
    });

    setCartItems(loadedItems);
    setOrderNote(order.note || '');
    if (order.voucherCode) {
      const foundOffer = offers.find(o => o.code === order.voucherCode);
      if (foundOffer) {
        setAppliedVoucher(foundOffer);
      }
    }
  };

  const isOfferSaved = (offerId: string) => savedOfferIds.has(offerId);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        totalCount,
        totalAmount,
        shippingFee,
        discountAmount,
        finalTotal,
        lastAddedItem,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        favorites,
        toggleFavorite,
        isFavorite,
        appliedVoucher,
        applyVoucher,
        orderNote,
        setOrderNote,
        savedOfferIds,
        toggleSaveOffer,
        isOfferSaved,
        loadOrderIntoCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
