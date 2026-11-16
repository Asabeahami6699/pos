import React from 'react';
import { Star } from 'lucide-react';

interface ProductRatingStarsProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
}

export const ProductRatingStars: React.FC<ProductRatingStarsProps> = ({
  rating,
  count = 0,
  size = 'sm',
  showCount = true,
}) => {
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  const rounded = Math.round(rating * 2) / 2;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${iconSize} ${
              star <= rounded
                ? 'fill-amber-400 text-amber-400'
                : star - 0.5 <= rounded
                  ? 'fill-amber-400/50 text-amber-400'
                  : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
      {showCount && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {count > 0 ? `${rating.toFixed(1)} (${count})` : 'No ratings yet'}
        </span>
      )}
    </div>
  );
};
