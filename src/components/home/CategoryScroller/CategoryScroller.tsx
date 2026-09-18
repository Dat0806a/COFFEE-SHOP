import React from 'react';
import { Category } from '../../../types';
import { CategoryItem } from '../CategoryItem/CategoryItem';
import './CategoryScroller.css';

interface CategoryScrollerProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export const CategoryScroller: React.FC<CategoryScrollerProps> = ({
  categories,
  selectedCategory,
  onSelectCategory
}) => {
  const handleToggle = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      onSelectCategory(null); // Deselect to show all
    } else {
      onSelectCategory(categoryId);
    }
  };

  return (
    <div className="category-scroller-wrapper">
      <div className="category-scroller-track">
        {categories.map((cat) => (
          <CategoryItem
            key={cat.id}
            category={cat}
            isSelected={selectedCategory === cat.id}
            onSelect={handleToggle}
          />
        ))}
      </div>
    </div>
  );
};
