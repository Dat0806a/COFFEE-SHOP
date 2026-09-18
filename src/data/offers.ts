import { Offer } from '../types';

export const offers: Offer[] = [
  {
    id: 'off-1',
    title: 'GIẢM 20K',
    code: 'ANATHAI20',
    discountAmount: 20,
    discountType: 'fixed',
    minOrder: 99,
    description: 'Áp dụng cho đơn hàng từ 99K toàn menu',
    expiryDate: '30/09/2026',
    category: 'all',
    isSaved: true,
    tag: 'Phổ biến nhất'
  },
  {
    id: 'off-2',
    title: 'FREESHIP 20K',
    code: 'FREESHIPANA',
    discountAmount: 20,
    discountType: 'freeship',
    minOrder: 150,
    description: 'Miễn phí giao hàng cho đơn từ 150K trong bán kính 5km',
    expiryDate: '31/10/2026',
    category: 'freeship',
    isSaved: false,
    tag: 'Freeship'
  },
  {
    id: 'off-3',
    title: 'MUA 2 TẶNG 1',
    code: 'MUA2TANG1',
    discountAmount: 35,
    discountType: 'combo',
    minOrder: 70,
    description: 'Tặng 1 Trà sữa Thái đỏ khi mua 2 ly đồ uống bất kỳ',
    expiryDate: '25/09/2026',
    category: 'drinks',
    isSaved: false,
    tag: 'Đồ uống'
  },
  {
    id: 'off-4',
    title: 'GIẢM 15%',
    code: 'BIRTHDAYANA',
    discountAmount: 15,
    discountType: 'percent',
    minOrder: 120,
    description: 'Ưu đãi sinh nhật thành viên ANA Chiang Mai',
    expiryDate: '15/10/2026',
    category: 'all',
    isSaved: true,
    tag: 'Thành viên'
  },
  {
    id: 'off-5',
    title: 'GIẢM 15K MÓN XÔI',
    code: 'XOITHAI15',
    discountAmount: 15,
    discountType: 'fixed',
    minOrder: 80,
    description: 'Giảm 15K khi mua combo 2 phần xôi Thái bất kỳ',
    expiryDate: '20/09/2026',
    category: 'food',
    isSaved: false,
    tag: 'Món ăn'
  },
  {
    id: 'off-6',
    title: 'GIẢM 30K KHAI TRƯƠNG',
    code: 'WELCOME30',
    discountAmount: 30,
    discountType: 'fixed',
    minOrder: 100,
    description: 'Ưu đãi mừng khai trương chi nhánh mới',
    expiryDate: '01/09/2026',
    category: 'all',
    isSaved: false,
    isExpired: true,
    tag: 'Đã hết hạn'
  }
];
