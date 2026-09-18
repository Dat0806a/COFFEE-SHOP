import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Award,
  Layers,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import { storeService } from '../../services/storeService';
import { useStore } from '../../context/StoreContext';
import './AdminRevenuePage.css';

export const AdminRevenuePage: React.FC = () => {
  // Subscribe to context updates for realtime ledger refresh
  useStore();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const stats = storeService.getRevenueStats(selectedYear);

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  // Find max value in 7 days for relative bar chart scaling
  const max7DayRevenue = Math.max(...stats.last7Days.map((d) => d.total), 1);

  return (
    <div className="admin-revenue-page">
      {/* 1. Header with Year Selector */}
      <div className="revenue-page-header">
        <div>
          <h1 className="admin-page-title">Báo cáo & Phân tích Doanh thu</h1>
          <p className="admin-page-subtitle">
            Dữ liệu tổng hợp chính xác từ các đơn hàng đã phục vụ hoàn thành (COMPLETED)
          </p>
        </div>

        <div className="revenue-year-picker-wrap">
          <Calendar size={16} className="picker-icon" />
          <span className="picker-label">Năm báo cáo:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="year-select-dropdown"
          >
            {stats.availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Năm {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Top Revenue Metrics Grid */}
      <div className="revenue-summary-grid">
        <div className="rev-stat-card highlight">
          <div className="stat-card-head">
            <span className="stat-label">HÔM NAY</span>
            <DollarSign size={18} className="stat-icon" />
          </div>
          <div className="stat-big-val">{formatVND(stats.todayRevenue)}</div>
          <div className="stat-sub-text">{stats.completedTodayCount} đơn hoàn thành trong ngày</div>
        </div>

        <div className="rev-stat-card">
          <div className="stat-card-head">
            <span className="stat-label">THÁNG NÀY</span>
            <TrendingUp size={18} className="stat-icon" />
          </div>
          <div className="stat-big-val">{formatVND(stats.monthRevenue)}</div>
          <div className="stat-sub-text">
            Tháng {new Date().getMonth() + 1}/{selectedYear}
          </div>
        </div>

        <div className="rev-stat-card">
          <div className="stat-card-head">
            <span className="stat-label">CẢ NĂM {selectedYear}</span>
            <Award size={18} className="stat-icon" />
          </div>
          <div className="stat-big-val">{formatVND(stats.yearRevenue)}</div>
          <div className="stat-sub-text">{stats.totalCompletedOrders} đơn hàng hoàn tất</div>
        </div>

        <div className="rev-stat-card">
          <div className="stat-card-head">
            <span className="stat-label">GIÁ TRỊ TRUNG BÌNH (AOV)</span>
            <Layers size={18} className="stat-icon" />
          </div>
          <div className="stat-big-val">{formatVND(stats.aov)}</div>
          <div className="stat-sub-text">Trung bình mỗi đơn gọi món</div>
        </div>
      </div>

      {/* 3. Charts: 7 Days & 12 Months Breakdown */}
      <div className="revenue-charts-grid">
        {/* 7 Days Daily Trend */}
        <div className="chart-panel-card">
          <div className="chart-panel-head">
            <div className="panel-title-row">
              <BarChart3 size={18} className="panel-icon" />
              <h2 className="panel-title">Doanh thu 7 ngày gần nhất</h2>
            </div>
            <span className="panel-badge-tag">Theo ngày</span>
          </div>

          <div className="bar-chart-container">
            {stats.last7Days.map((day, idx) => {
              const heightPct = Math.max(8, Math.round((day.total / max7DayRevenue) * 100));
              const isToday = idx === stats.last7Days.length - 1;

              return (
                <div key={day.date} className="bar-col">
                  <div className="bar-val-label">{day.total > 0 ? `${day.total}K` : '0'}</div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${isToday ? 'today-bar' : ''}`}
                      style={{ height: `${heightPct}%` }}
                    ></div>
                  </div>
                  <div className={`bar-date-label ${isToday ? 'today-text' : ''}`}>
                    {day.label}
                  </div>
                  <div className="bar-count-sub">{day.orderCount} đơn</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 12 Months Yearly Distribution */}
        <div className="chart-panel-card">
          <div className="chart-panel-head">
            <div className="panel-title-row">
              <Calendar size={18} className="panel-icon" />
              <h2 className="panel-title">Lịch sử 12 Tháng - Năm {selectedYear}</h2>
            </div>
            <span className="panel-badge-tag">Lịch sử vĩnh viễn</span>
          </div>

          <div className="monthly-table-wrap">
            <table className="monthly-data-table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Số đơn</th>
                  <th>Tỷ trọng</th>
                  <th style={{ textAlign: 'right' }}>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyBreakdown.map((m) => {
                  const pct = stats.yearRevenue > 0 ? Math.round((m.total / stats.yearRevenue) * 100) : 0;
                  const isCurrentMonth = selectedYear === new Date().getFullYear() && m.month === new Date().getMonth() + 1;

                  return (
                    <tr key={m.month} className={isCurrentMonth ? 'current-month-row' : ''}>
                      <td>
                        <span className="month-name">{m.label}</span>
                        {isCurrentMonth && <span className="curr-tag">Hiện tại</span>}
                      </td>
                      <td>{m.orderCount} đơn</td>
                      <td>
                        <div className="table-bar-progress">
                          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                          <span className="progress-pct-text">{pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', color: '#2C1808' }}>
                        {formatVND(m.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Top Selling Products (From Completed Orders) */}
      <div className="top-sales-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <FileSpreadsheet size={18} className="panel-icon" />
            <h2 className="panel-title">Top 10 Món đóng góp doanh thu cao nhất</h2>
          </div>
        </div>

        <div className="top-sales-table-wrap">
          {stats.topProducts.length === 0 ? (
            <p className="empty-panel-text" style={{ padding: '30px 0', textAlign: 'center', color: '#8C7F72' }}>
              Chưa có đơn hàng nào hoàn tất để thống kê món bán chạy
            </p>
          ) : (
            <table className="top-sales-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Hạng</th>
                  <th style={{ width: '70px' }}>Ảnh</th>
                  <th>Tên món</th>
                  <th>Số lượng đã bán</th>
                  <th style={{ textAlign: 'right' }}>Tổng doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p, idx) => (
                  <tr key={p.productId}>
                    <td>
                      <span className={`rank-pill rank-${idx + 1}`}>#{idx + 1}</span>
                    </td>
                    <td>
                      <img src={p.image} alt={p.productName} className="top-sales-thumb" />
                    </td>
                    <td>
                      <div className="prod-name-bold">{p.productName}</div>
                    </td>
                    <td>
                      <span className="prod-sales-qty">{p.totalQuantity} ly</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="prod-rev-bold">{formatVND(p.totalRevenue)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
