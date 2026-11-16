import React, { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '../Button';
import { validateProductImage } from '../../lib/productImageUpload';

interface ProductImageFieldProps {
  value: File | null;
  previewUrl: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  existingImageUrl?: string | null;
}

export const ProductImageField: React.FC<ProductImageFieldProps> = ({
  value,
  previewUrl,
  onChange,
  existingImageUrl,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = previewUrl || existingImageUrl;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onChange(file, URL.createObjectURL(file));
  };

  const clearImage = () => {
    onChange(null, null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Product image</label>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="w-28 h-28 rounded-lg bg-secondary/80 border border-border overflow-hidden flex items-center justify-center shrink-0">
          {displayUrl ? (
            <img src={displayUrl} alt="Product preview" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-8 h-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {displayUrl ? 'Change image' : 'Upload image'}
          </Button>
          {(value || previewUrl) && (
            <Button type="button" variant="ghost" size="sm" onClick={clearImage} className="text-destructive">
              <X className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">
            Shown on the marketplace. JPG, PNG, WebP or GIF, max 5MB.
          </p>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
};
