import { OrderHistoryItem } from '../types';

export const orderHistory: OrderHistoryItem[] = [
  {
    id: 'ord-1028',
    orderNumber: '#ANA1028',
    date: '12/09/2026 • 15:30',
    itemsSummary: 'Trà sữa Thái đỏ + 2 món',
    totalAmount: 154,
    status: 'delivered',
    statusText: 'Đã giao',
    itemCount: 3
  },
  {
    id: 'ord-1025',
    orderNumber: '#ANA1025',
    date: '10/09/2026 • 11:20',
    itemsSummary: 'Xôi xoài Thái • 1 phần',
    totalAmount: 49,
    status: 'delivered',
    statusText: 'Đã giao',
    itemCount: 1
  },
  {
    id: 'ord-1019',
    orderNumber: '#ANA1019',
    date: '05/09/2026 • 09:15',
    itemsSummary: 'Matcha dừa + Cà phê dừa',
    totalAmount: 77,
    status: 'delivered',
    statusText: 'Đã giao',
    itemCount: 2
  }
];
