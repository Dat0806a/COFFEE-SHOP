import React, { useState, useMemo } from 'react';
import { Sparkles, Clock, ArrowRight, Bookmark, Check, Ticket } from 'lucide-react';
import { offers } from '../../data/offers';
import { useCart } from '../../context/CartContext';
import { Offer } from '../../types';
import './OffersPage.css';

interface OffersPageProps {
  onNavigateToCategories: () => void;
  onNavigateToCart: () => void;
}

type OfferCategory = 'all' | 'drinks' | 'food' | 'freeship';

export const OffersPage: React.FC<OffersPageProps> = ({
  onNavigateToCategories,
  onNavigateToCart
}) => {
  const [activeFilter, setActiveFilter] = useState<OfferCategory>('all');
  const { savedOfferIds, toggleSaveOffer, applyVoucher, appliedVoucher } = useCart();

  const filteredOffers = useMemo(() => {
    if (activeFilter === 'all') return offers;
    return offers.filter((o) => o.category === activeFilter);
  }, [activeFilter]);

  const handleApplyVoucher = (offer: Offer) => {
    applyVoucher(offer);
    onNavigateToCart();
  };

  return (
    <div className="offers-page">
      {/* 1. Header */}
      <header className="offers-header">
        <h1 className="page-title">Ưu đãi</h1>
        <span className="page-subtitle">Một chút ưu ái dành riêng cho bạn</span>
      </header>

      {/* 2. Featured Offer Hero Banner */}
      <div className="featured-hero-wrapper">
        <div className="featured-hero-card">
          <div className="featured-bg-motif" />

          <div className="featured-badge-row">
            <span className="featured-pill">
              <Sparkles size={12} /> ĐẶC QUYỀN HÔM NAY
            </span>
            <div className="time-pill">
              <Clock size={11} /> 14:00 – 17:00
            </div>
          </div>

          <div className="featured-hero-body">
            <h2 className="featured-title">Thai Tea Happy Hour</h2>
            <p className="featured-desc">
              Mua 2 ly Trà sữa Thái bất kỳ — <strong>Giảm ngay 20%</strong>
            </p>
          </div>

          <div className="featured-hero-bottom">
            <span className="featured-code-tag">MÃ: HAPPYTHAI</span>
            <button className="featured-cta-btn" onClick={onNavigateToCategories}>
              <span>Đặt ngay</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Category Filter Tabs */}
      <div className="offers-filter-bar">
        <button
          className={`filter-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          Tất cả
        </button>
        <button
          className={`filter-tab-btn ${activeFilter === 'drinks' ? 'active' : ''}`}
          onClick={() => setActiveFilter('drinks')}
        >
          Đồ uống
        </button>
        <button
          className={`filter-tab-btn ${activeFilter === 'food' ? 'active' : ''}`}
          onClick={() => setActiveFilter('food')}
        >
          Món ăn
        </button>
        <button
          className={`filter-tab-btn ${activeFilter === 'freeship' ? 'active' : ''}`}
          onClick={() => setActiveFilter('freeship')}
        >
          Freeship
        </button>
      </div>

      {/* 4. Voucher List */}
      <div className="voucher-cards-list">
        {filteredOffers.map((offer) => {
          const isSaved = savedOfferIds.has(offer.id);
          const isApplied = appliedVoucher?.id === offer.id;

          return (
            <div
              key={offer.id}
              className={`offer-ticket-card ${offer.isExpired ? 'expired' : ''}`}
            >
              {/* Left Ticket Stub */}
              <div className="ticket-stub-left">
                <span className="ticket-value">{offer.title}</span>
                <span className="ticket-min-order">Đơn từ {offer.minOrder}K</span>
                <div className="ticket-cutout-top" />
                <div className="ticket-cutout-bottom" />
              </div>

              {/* Right Ticket Content */}
              <div className="ticket-content-right">
                <div className="ticket-top-row">
                  <span className="ticket-tag">{offer.tag || 'Ưu đãi ANA'}</span>
                  <span className="ticket-expiry">HSD: {offer.expiryDate}</span>
                </div>

                <p className="ticket-description">{offer.description}</p>

                <div className="ticket-actions-row">
                  <span className="ticket-code-pill">{offer.code}</span>

                  <div className="ticket-buttons-group">
                    {!offer.isExpired ? (
                      <>
                        <button
                          className={`ticket-save-btn ${isSaved ? 'saved' : ''}`}
                          onClick={() => toggleSaveOffer(offer.id)}
                          aria-label={isSaved ? 'Đã lưu' : 'Lưu voucher'}
                        >
                          {isSaved ? (
                            <>
                              <Check size={13} />
                              <span>Đã lưu</span>
                            </>
                          ) : (
                            <>
                              <Bookmark size={13} />
                              <span>Lưu</span>
                            </>
                          )}
                        </button>

                        <button
                          className={`ticket-use-btn ${isApplied ? 'applied' : ''}`}
                          onClick={() => handleApplyVoucher(offer)}
                        >
                          {isApplied ? 'Đang dùng' : 'Dùng ngay'}
                        </button>
                      </>
                    ) : (
                      <span className="ticket-expired-label">Đã hết hạn</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredOffers.length === 0 && (
        <div className="offers-empty-state">
          <Ticket size={36} color="#A3978B" />
          <p>Chưa có mã ưu đãi trong mục này</p>
        </div>
      )}
    </div>
  );
};
