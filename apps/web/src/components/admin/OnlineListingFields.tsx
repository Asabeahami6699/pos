import React, { useState } from 'react';
import { Globe, Ruler, X } from 'lucide-react';
import { Input } from '../Input';

export interface OnlineListingFormData {
  isOnlineListing: boolean;
  about: string;
  variations: string;
  sizeGuide: string;
  keyHighlights: string;
  specifications: string;
  keyFeatures: string;
  weightKg: string;
  productDetails: string;
}

export const EMPTY_ONLINE_LISTING: OnlineListingFormData = {
  isOnlineListing: false,
  about: '',
  variations: '',
  sizeGuide: '',
  keyHighlights: '',
  specifications: '',
  keyFeatures: '',
  weightKg: '',
  productDetails: '',
};

interface OnlineListingFieldsProps {
  value: OnlineListingFormData;
  onChange: (next: OnlineListingFormData) => void;
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  helperText?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label ? <label className="text-sm font-medium text-foreground">{label}</label> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[72px]"
      />
      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

export const OnlineListingFields: React.FC<OnlineListingFieldsProps> = ({ value, onChange }) => {
  const [sizeInput, setSizeInput] = useState('');

  const patch = (partial: Partial<OnlineListingFormData>) => onChange({ ...value, ...partial });

  const variationList = value.variations
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const addVariation = () => {
    const next = sizeInput.trim();
    if (!next) return;
    const merged = [...new Set([...variationList, next])];
    patch({ variations: merged.join(', ') });
    setSizeInput('');
  };

  const removeVariation = (size: string) => {
    patch({ variations: variationList.filter((v) => v !== size).join(', ') });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-sky-200 bg-sky-500/5">
      <div className="flex items-start gap-3">
        <Globe className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.isOnlineListing}
              onChange={(e) => patch({ isOnlineListing: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-semibold text-foreground">List as online marketplace product</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Optional rich details for customers on the shop — sizes, specs, and product story. All fields below are optional.
          </p>
        </div>
      </div>

      {value.isOnlineListing && (
        <div className="space-y-4 pt-2 border-t border-sky-200/60">
          <TextArea
            label="About this product"
            value={value.about}
            onChange={(about) => patch({ about })}
            placeholder="A short overview shoppers see first — what it is, who it's for, and why they'll like it."
            rows={4}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Variations available</label>
            <div className="flex flex-wrap gap-2">
              {variationList.map((size) => (
                <span
                  key={size}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-xs font-medium"
                >
                  {size}
                  <button
                    type="button"
                    onClick={() => removeVariation(size)}
                    className="p-0.5 rounded hover:bg-muted"
                    aria-label={`Remove ${size}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                placeholder="e.g. M, L, XL or 42"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addVariation();
                  }
                }}
              />
              <button
                type="button"
                onClick={addVariation}
                className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-secondary"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">Size guide</label>
            </div>
            <TextArea
              label=""
              value={value.sizeGuide}
              onChange={(sizeGuide) => patch({ sizeGuide })}
              placeholder={`One size per line, e.g.\nM — Shoulder 48cm, Chest 112cm, Length 74cm\nL — Shoulder 50cm, Chest 117cm, Length 76cm`}
              rows={5}
              helperText="Measurements help customers pick the right fit."
            />
          </div>

          <TextArea
            label="Key highlights"
            value={value.keyHighlights}
            onChange={(keyHighlights) => patch({ keyHighlights })}
            placeholder="One bullet per line — comfort, material, occasion, etc."
            rows={4}
          />

          <TextArea
            label="Specifications"
            value={value.specifications}
            onChange={(specifications) => patch({ specifications })}
            placeholder="Material, pattern, fit, care instructions, composition…"
            rows={4}
          />

          <TextArea
            label="Key features"
            value={value.keyFeatures}
            onChange={(keyFeatures) => patch({ keyFeatures })}
            placeholder="Standout features — breathable fabric, wrinkle-resistant, includes accessories…"
            rows={3}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Weight (kg)"
              type="number"
              step="0.01"
              min="0"
              value={value.weightKg}
              onChange={(e) => patch({ weightKg: e.target.value })}
              placeholder="e.g. 0.5"
            />
          </div>

          <TextArea
            label="Product details"
            value={value.productDetails}
            onChange={(productDetails) => patch({ productDetails })}
            placeholder="What's included, styling tips, brand story, or extra context for buyers."
            rows={5}
          />
        </div>
      )}
    </div>
  );
};
