import React, { useState } from 'react';
import { ChevronDown, Package, Sparkles, ClipboardList, Ruler, ListChecks } from 'lucide-react';
import type { ShopCompany, ShopProduct } from '../../stores/ecommerceCatalogStore';
import {
  buildProductHighlights,
  buildProductSpecs,
  getProductAboutText,
  getProductDetailsText,
  getProductKeyFeaturesText,
  getProductSizeGuide,
  getProductSpecificationsText,
  getProductVariations,
  productHasOnlineListing,
} from '../../lib/productDetailContent';

interface ProductDescriptionSectionProps {
  product: ShopProduct;
  company: ShopCompany;
}

function AccordionPanel({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-secondary/40 hover:bg-secondary/70 transition-colors"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 py-3 text-sm text-muted-foreground space-y-2">{children}</div>}
    </div>
  );
}

export const ProductVariationPicker: React.FC<{
  variations: string[];
  selected?: string | null;
  onSelect?: (size: string) => void;
}> = ({ variations, selected, onSelect }) => {
  if (variations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Variation available</p>
        {selected && <span className="text-[10px] text-muted-foreground">Selected: {selected}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {variations.map((size) => {
          const active = selected === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onSelect?.(size)}
              className={`min-w-[2.5rem] px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/50'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ProductDescriptionSection: React.FC<ProductDescriptionSectionProps> = ({
  product,
  company,
}) => {
  const variations = getProductVariations(product);
  const about = getProductAboutText(product);
  const highlights = buildProductHighlights(product);
  const specs = buildProductSpecs(product, company);
  const specificationsText = getProductSpecificationsText(product);
  const keyFeatures = getProductKeyFeaturesText(product);
  const productDetails = getProductDetailsText(product);
  const sizeGuide = getProductSizeGuide(product);
  const hasRichListing = productHasOnlineListing(product);

  if (!hasRichListing && variations.length === 0) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Product information</h2>

      <AccordionPanel title="About this product" icon={Package} defaultOpen>
        <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{about}</p>
      </AccordionPanel>

      {highlights.length > 0 && (
        <AccordionPanel title="Key highlights" icon={Sparkles} defaultOpen={!specificationsText}>
          <ul className="list-disc pl-5 space-y-1.5">
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </AccordionPanel>
      )}

      {(specificationsText || specs.length > 0) && (
        <AccordionPanel title="Specifications" icon={ClipboardList}>
          {specificationsText && (
            <p className="text-foreground/90 leading-relaxed whitespace-pre-line mb-3">{specificationsText}</p>
          )}
          <dl className="divide-y divide-border">
            {specs.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <dt className="text-muted-foreground shrink-0">{label}</dt>
                <dd className="text-foreground text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </AccordionPanel>
      )}

      {keyFeatures && (
        <AccordionPanel title="Key features" icon={ListChecks}>
          <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{keyFeatures}</p>
        </AccordionPanel>
      )}

      {productDetails && (
        <AccordionPanel title="Product details" icon={Package}>
          <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{productDetails}</p>
        </AccordionPanel>
      )}

      {sizeGuide && (
        <AccordionPanel title="Size guide" icon={Ruler}>
          <p className="text-foreground/90 leading-relaxed whitespace-pre-line font-mono text-xs">{sizeGuide}</p>
        </AccordionPanel>
      )}
    </div>
  );
};
