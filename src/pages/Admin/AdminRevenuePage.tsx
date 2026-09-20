import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Award,
  Layers,
  BarChart3,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  RotateCw,
  Clock,
  Hourglass,
  CheckCircle2
} from 'lucide-react';
import { storeService } from '../../services/storeService';
import { useStore } from '../../context/StoreContext';
import { useDialog } from '../../context/DialogContext';
import {
  getVietnamCurrentMonth,
  getRemainingDaysInMonth,
  getRemainingDaysInYear,
  RemainingTimeInfo
} from '../../types';
import './AdminRevenuePage.css';

export const AdminRevenuePage: React.FC = () => {
  const { runMonthlyCleanup } = useStore();
  const { showSuccess, showConfirm } = useDialog();

  const currentVietnamMonthStr = getVietnamCurrentMonth(); // "YYYY-MM"
  const nowYear = parseInt(currentVietnamMonthStr.slice(0, 4), 10) || new Date().getFullYear();
  const nowMonth = parseInt(currentVietnamMonthStr.slice(5, 7), 10) || (new Date().getMonth() + 1);

  const [selectedYear, setSelectedYear] = useState<number>(nowYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const stats = storeService.getRevenueStats(
    selectedYear,
    selectedMonth === 'ALL' ? undefined : selectedMonth
  );

  // Compute countdown & remaining time in selected period (Month or Year)
  const remainingTimeInfo: RemainingTimeInfo =
    selectedMonth === 'ALL'
      ? getRemainingDaysInYear(selectedYear)
      : getRemainingDaysInMonth(selectedYear, selectedMonth);

  const formatVND = (kValue: number) => {
    return (kValue * 1000).toLocaleString('vi-VN') + 'đ';
  };

  // Find max value in 7 days for relative bar chart scaling
  const max7DayRevenue = Math.max(...stats.last7Days.map((d) => d.total), 1);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 'ALL') {
      setSelectedMonth(nowMonth);
      return;
    }
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((prev) => (prev as number) - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'ALL') {
      setSelectedMonth(nowMonth);
      return;
    }
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((prev) => (prev as number) + 1);
    }
  };

  const isCurrentMonthView =
    selectedMonth !== 'ALL' &&
    selectedYear === nowYear &&
    selectedMonth === nowMonth;

  const isPastMonthView =
    selectedMonth !== 'ALL' &&
    (selectedYear < nowYear || (selectedYear === nowYear && selectedMonth < nowMonth));

  const handleRunCleanup = () => {
    showConfirm({
      title: 'Chốt sổ & Lưu snapshot tháng cũ?',
      message:
        'Hệ thống sẽ tính toán và lưu snapshot thống kê vĩnh viễn cho các tháng đã kết thúc trước khi dọn dẹp chi tiết đơn cũ. Bạn có muốn thực hiện ngay?',
      confirmText: 'Chốt sổ ngay',
      cancelText: 'Đóng',
      onConfirm: async () => {
        setIsCleaningUp(true);
        try {
          const res = await runMonthlyCleanup();
          showSuccess({
            title: 'Chốt sổ thành công',
            message: `Đã cập nhật ${res.snapshotsCreated} snapshot tháng và dọn dẹp an toàn ${res.cleanedCount} đơn hàng cũ.`
          });
        } catch {
          // ignore
        } finally {
          setIsCleaningUp(false);
        }
      }
    });
  };

  const monthDetail = stats.selectedMonthStats;

  return (
    <div className="admin-revenue-page">
      {/* 1. Header with Year & Month Selector */}
      <div className="revenue-page-header">
        <div>
          <h1 className="admin-page-title">Báo cáo & Thống kê Doanh thu</h1>
          <p className="admin-page-subtitle">
            Dữ liệu tổng hợp chính xác từ các đơn hàng đã hoàn thành (COMPLETED) theo tháng & năm
          </p>
        </div>

        <div className="revenue-controls-cluster">
          {/* Month Stepper Selector */}
          <div className="month-stepper-wrap">
            <button
              className="month-step-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="month-stepper-display">
              <Calendar size={14} className="stepper-icon" />
              <select
                className="month-select-dropdown"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(
                    e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10)
                  )
                }
              >
                <option value="ALL">Cả năm {selectedYear}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m < 10 ? `0${m}` : m}/{selectedYear}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="month-step-btn"
              onClick={handleNextMonth}
              title="Tháng sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Year Picker Dropdown */}
          <div className="revenue-year-picker-wrap">
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

          {/* Manual Safe Cleanup Trigger */}
          <button
            className="cleanup-sync-btn"
            onClick={handleRunCleanup}
            disabled={isCleaningUp}
            title="Chốt snapshot tháng cũ và đồng bộ dữ liệu"
          >
            <RotateCw size={14} className={isCleaningUp ? 'spin-anim' : ''} />
            <span>Chốt sổ snapshot</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC COUNTDOWN & CYCLE STATUS BANNER */}
      <div className={`revenue-countdown-banner mode-${remainingTimeInfo.status.toLowerCase()}`}>
        <div className="banner-left-content">
          <div className="banner-badge-row">
            <span className="cycle-mode-pill">
              {remainingTimeInfo.mode === 'MONTH' ? (
                <>
                  <Calendar size={12} /> THEO THÁNG
                </>
              ) : (
                <>
                  <Award size={12} /> THEO NĂM
                </>
              )}
            </span>

            <span className={`countdown-status-pill status-${remainingTimeInfo.status.toLowerCase()}`}>
              {remainingTimeInfo.status === 'CURRENT' && <Hourglass size={12} className="pulse-icon" />}
              {remainingTimeInfo.status === 'PAST' && <CheckCircle2 size={12} />}
              {remainingTimeInfo.status === 'FUTURE' && <Clock size={12} />}
              {remainingTimeInfo.badge}
            </span>
          </div>

          <h2 className="banner-countdown-title">{remainingTimeInfo.title}</h2>
          <p className="banner-countdown-sub">{remainingTimeInfo.subText}</p>
        </div>

        <div className="banner-right-progress">
          <div className="progress-top-row">
            <span className="progress-label-text">
              {remainingTimeInfo.mode === 'MONTH' ? 'Chu kỳ tháng' : 'Chu kỳ năm'}
            </span>
            <span className="progress-value-badge">
              {remainingTimeInfo.passedDays}/{remainingTimeInfo.totalDays} ngày ({remainingTimeInfo.percentPassed}%)
            </span>
          </div>

          <div className="banner-progress-track">
            <div
              className={`banner-progress-fill status-${remainingTimeInfo.status.toLowerCase()}`}
              style={{ width: `${remainingTimeInfo.percentPassed}%` }}
            ></div>
          </div>

          {remainingTimeInfo.status === 'CURRENT' && (
            <div className="countdown-days-callout">
              <span className="countdown-big-number">{remainingTimeInfo.remainingDays}</span>
              <span className="countdown-number-unit">ngày còn lại</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Top Revenue Metrics Grid */}
      {selectedMonth === 'ALL' ? (
        // ALL YEAR VIEW
        <div className="revenue-summary-grid">
          <div className="rev-stat-card highlight">
            <div className="stat-card-head">
              <span className="stat-label">HÔM NAY ({nowMonth}/{nowYear})</span>
              <DollarSign size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">{formatVND(stats.todayRevenue)}</div>
            <div className="stat-sub-text">
              {stats.completedTodayCount} đơn hoàn thành trong ngày
            </div>
          </div>

          <div className="rev-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">THÁNG HIỆN TẠI</span>
              <TrendingUp size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">{formatVND(stats.monthRevenue)}</div>
            <div className="stat-sub-text">
              Tháng {nowMonth}/{selectedYear}
            </div>
          </div>

          <div className="rev-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">CẢ NĂM {selectedYear}</span>
              <Award size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">{formatVND(stats.yearRevenue)}</div>
            <div className="stat-sub-text">
              {stats.totalCompletedOrders} đơn hàng hoàn tất
              {selectedYear === nowYear && remainingTimeInfo.remainingDays > 0 && (
                <span className="inline-countdown-tag">
                  • Còn {remainingTimeInfo.remainingDays} ngày hết năm
                </span>
              )}
            </div>
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
      ) : (
        // SPECIFIC MONTH VIEW
        <div className="revenue-summary-grid">
          <div className="rev-stat-card highlight">
            <div className="stat-card-head">
              <span className="stat-label">
                DOANH THU THÁNG {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}/{selectedYear}
              </span>
              <DollarSign size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">
              {formatVND(monthDetail?.revenue || 0)}
            </div>
            <div className="stat-sub-text">
              {isCurrentMonthView && (
                <span className="month-status-tag realtime">
                  <Sparkles size={11} /> Realtime (Còn {remainingTimeInfo.remainingDays} ngày)
                </span>
              )}
              {isPastMonthView && (
                <span className="month-status-tag snapshot">
                  ✓ Snapshot đã lưu vĩnh viễn
                </span>
              )}
            </div>
          </div>

          <div className="rev-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">SỐ ĐƠN HOÀN THÀNH</span>
              <Award size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">
              {monthDetail?.completedOrders || 0}
            </div>
            <div className="stat-sub-text">Đơn hoàn thành trong tháng</div>
          </div>

          <div className="rev-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">TỔNG MÓN ĐÃ BÁN</span>
              <ShoppingBag size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">
              {monthDetail?.itemsSold || 0}
            </div>
            <div className="stat-sub-text">Ly / món ăn đã phục vụ</div>
          </div>

          <div className="rev-stat-card">
            <div className="stat-card-head">
              <span className="stat-label">GIÁ TRỊ TRUNG BÌNH (AOV)</span>
              <Layers size={18} className="stat-icon" />
            </div>
            <div className="stat-big-val">
              {formatVND(monthDetail?.averageOrderValue || 0)}
            </div>
            <div className="stat-sub-text">Doanh thu / số đơn hoàn thành</div>
          </div>
        </div>
      )}

      {/* 3. Charts: 7 Days Trend & 12 Months Breakdown */}
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
              const heightPct = Math.max(
                8,
                Math.round((day.total / max7DayRevenue) * 100)
              );
              const isToday = idx === stats.last7Days.length - 1;

              return (
                <div key={day.date} className="bar-col">
                  <div className="bar-val-label">
                    {day.total > 0 ? `${day.total}K` : '0'}
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${isToday ? 'today-bar' : ''}`}
                      style={{ height: `${heightPct}%` }}
                    ></div>
                  </div>
                  <div
                    className={`bar-date-label ${isToday ? 'today-text' : ''}`}
                  >
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
              <h2 className="panel-title">
                Lịch sử 12 Tháng - Năm {selectedYear}
              </h2>
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
                  const pct =
                    stats.yearRevenue > 0
                      ? Math.round((m.total / stats.yearRevenue) * 100)
                      : 0;
                  const isCurrentMonth =
                    selectedYear === nowYear && m.month === nowMonth;
                  const isRowSelected =
                    selectedMonth !== 'ALL' && m.month === selectedMonth;

                  return (
                    <tr
                      key={m.month}
                      className={`${isCurrentMonth ? 'current-month-row' : ''} ${
                        isRowSelected ? 'selected-month-row' : ''
                      }`}
                      onClick={() => setSelectedMonth(m.month)}
                      style={{ cursor: 'pointer' }}
                      title={`Bấm để xem chi tiết Tháng ${m.month}/${selectedYear}`}
                    >
                      <td>
                        <span className="month-name">{m.label}</span>
                        {isCurrentMonth && (
                          <span className="curr-tag">Hiện tại</span>
                        )}
                        {isRowSelected && (
                          <span className="selected-tag">Đang xem</span>
                        )}
                      </td>
                      <td>{m.orderCount} đơn</td>
                      <td>
                        <div className="table-bar-progress">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%` }}
                          ></div>
                          <span className="progress-pct-text">{pct}%</span>
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: '800',
                          color: '#2C1808'
                        }}
                      >
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

      {/* 4. Top Selling Products */}
      <div className="top-sales-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <FileSpreadsheet size={18} className="panel-icon" />
            <h2 className="panel-title">
              {selectedMonth === 'ALL'
                ? `Top 10 Món bán chạy nhất - Năm ${selectedYear}`
                : `Top Món bán chạy nhất - Tháng ${
                    selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
                  }/${selectedYear}`}
            </h2>
          </div>
          {selectedMonth !== 'ALL' && (
            <button
              className="view-all-year-btn"
              onClick={() => setSelectedMonth('ALL')}
            >
              Xem cả năm {selectedYear}
            </button>
          )}
        </div>

        <div className="top-sales-table-wrap">
          {stats.topProducts.length === 0 ? (
            <p
              className="empty-panel-text"
              style={{ padding: '30px 0', textAlign: 'center', color: '#8C7F72' }}
            >
              Chưa có đơn hàng nào hoàn tất trong thời gian đã chọn để thống kê món bán chạy
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
                      <span className={`rank-pill rank-${idx + 1}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td>
                      <img
                        src={p.image}
                        alt={p.productName}
                        className="top-sales-thumb"
                      />
                    </td>
                    <td>
                      <div className="prod-name-bold">{p.productName}</div>
                    </td>
                    <td>
                      <span className="prod-sales-qty">{p.totalQuantity} ly</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="prod-rev-bold">
                        {formatVND(p.totalRevenue)}
                      </span>
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
