import React from 'react';
import { Category } from '../../../types';

interface CategoryItemProps {
  category: Category;
  isSelected: boolean;
  onSelect: (categoryId: string) => void;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  isSelected,
  onSelect
}) => {
  return (
    <button
      className={`category-item-card ${isSelected ? 'active' : ''}`}
      onClick={() => onSelect(category.id)}
      aria-label={`Chọn danh mục ${category.name}`}
    >
      <div className="category-icon-box">
        {category.image ? (
          <img
            src={category.image}
            alt={category.name}
            className="category-item-img"
            loading="lazy"
          />
        ) : (
          <span className="category-emoji">{category.icon}</span>
        )}
      </div>
      <span className="category-label">{category.name}</span>
    </button>
  );
};
