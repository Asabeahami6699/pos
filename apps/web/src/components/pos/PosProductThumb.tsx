import React from 'react';
import { ProductImage } from '../shop/ProductImage';

interface PosProductThumbProps {
  imageUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PosProductThumb: React.FC<PosProductThumbProps> = ({
  imageUrl,
  name,
  size = 'md',
  className = '',
}) => {
  const box =
    size === 'sm'
      ? 'w-12 h-12 rounded-xl'
      : size === 'lg'
        ? 'w-full aspect-[4/3] rounded-xl mb-3 max-h-[140px]'
        : 'w-full aspect-square rounded-xl mb-2 max-h-[110px]';

  return (
    <div
      className={`${box} bg-secondary/80 flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    >
      <ProductImage
        imageUrl={imageUrl}
        name={name}
        className="w-full h-full object-cover"
        iconClassName="text-lg opacity-40"
      />
    </div>
  );
};
