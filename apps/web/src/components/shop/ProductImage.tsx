import React from 'react';

interface ProductImageProps {
  imageUrl?: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  imageUrl,
  name,
  className = 'w-full h-full object-cover',
  iconClassName = 'text-2xl opacity-40',
}) => {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={className} loading="lazy" />;
  }

  return <span className={iconClassName}>📦</span>;
};
