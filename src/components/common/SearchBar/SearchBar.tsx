import React from 'react';
import { Search, ScanLine } from 'lucide-react';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="search-bar-wrapper">
      <div className="search-bar-inner">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Tìm món uống, món ăn..."
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="scan-btn" aria-label="Quét mã QR">
          <ScanLine size={18} className="scan-icon" />
        </button>
      </div>
    </div>
  );
};
