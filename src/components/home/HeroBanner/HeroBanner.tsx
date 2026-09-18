import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import './HeroBanner.css';

interface HeroBannerProps {
  onOrderNow?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onOrderNow }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      brand: 'A N A   C H I A N G   M A I',
      title: 'XÔI XOÀI THÁI',
      tagline: 'Hương vị Thái\ngiữa lòng Việt',
      image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&auto=format&fit=crop&q=80',
      dishName: 'Xôi xoài béo ngậy nước cốt dừa'
    },
    {
      brand: 'A N A   C H I A N G   M A I',
      title: 'TRÀ SỮA THÁI ĐỎ',
      tagline: 'Đậm đà chuẩn vị\nChiang Mai truyền thống',
      image: '/trasua_img/8.png',
      dishName: 'Trà Thái đỏ thảo mộc'
    },
    {
      brand: 'A N A   C H I A N G   M A I',
      title: 'CHIANG MAI COFFEE',
      tagline: 'Thơm nồng cốt dừa\nĐậm vị cao nguyên',
      image: '/coffee_img/10.png',
      dishName: 'Chiang Mai Coconut Coffee'
    }
  ];

  // Auto-slide every 5 seconds (right to left)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero-banner-wrapper">
      <div className="hero-banner-card">
        {/* Carousel Sliding Track */}
        <div
          className="hero-carousel-track"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((slide, idx) => (
            <div key={idx} className="hero-slide-item">
              {/* Left Content Side */}
              <div className="hero-content">
                <span className="hero-brand-tag">{slide.brand}</span>
                <h2 className="hero-title">{slide.title}</h2>
                
                <div className="hero-ornament">
                  <span>❖</span>
                </div>

                <p className="hero-tagline">{slide.tagline}</p>

                <div className="hero-ornament">
                  <span>❖</span>
                </div>

                <button className="hero-cta-btn" onClick={onOrderNow}>
                  <span>Đặt ngay</span>
                  <ArrowRight size={15} className="hero-cta-icon" />
                </button>
              </div>

              {/* Right Visual Side */}
              <div className="hero-visual">
                <div className="hero-image-frame">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="hero-dish-img"
                  />
                </div>
                <div className="hero-script-badge">
                  <span>Thai</span>
                  <span>Good Food.</span>
                  <span>Good Mood.</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Pagination Dots */}
        <div className="hero-pagination">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`pagination-dot ${idx === activeSlide ? 'active' : ''}`}
              onClick={() => setActiveSlide(idx)}
              aria-label={`Chuyển đến slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
