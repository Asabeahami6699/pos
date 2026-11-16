import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { Modal } from '../Modal';

interface ProductImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export const ProductImageZoom: React.FC<ProductImageZoomProps> = ({ src, alt, className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative group block w-full ${className}`}
        aria-label="Zoom image"
      >
        <img src={src} alt={alt} className="w-full h-full object-contain" />
        <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-4 h-4" />
        </span>
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={alt} size="xl">
        <img src={src} alt={alt} className="w-full max-h-[70vh] object-contain mx-auto" />
      </Modal>
    </>
  );
};
