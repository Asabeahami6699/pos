import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import type { ShopProduct } from '../../stores/ecommerceCatalogStore';
import { CategoryProductTile } from '../../components/shop/CategoryProductTile';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import {
  groupProductsIntoSections,
  groupProductsByMainCategory,
  productMatchesCategoryFilter,
} from '../../lib/categoryGroups';
import { shopRoutes } from '../../lib/roleRedirect';

const SECTION_PREVIEW = 6;

export const CategoriesPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const marketplaceProducts = useEcommerceCatalogStore((s) => s.marketplaceProducts);
  const categories = useEcommerceCatalogStore((s) => s.categories);
  const sidebarCategory = useEcommerceCatalogStore((s) => s.sidebarCategory);
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const setSidebarCategory = useEcommerceCatalogStore((s) => s.setSidebarCategory);
  const marketplaceLoading = useEcommerceCatalogStore((s) => s.marketplaceLoading);

  const viewAll = searchParams.get('view') === 'all';
  const sectionFilter = searchParams.get('section');

  useEffect(() => {
    const fromUrl = categorySlug ? decodeURIComponent(categorySlug) : null;
    const fromQuery = searchParams.get('cat');
    setSidebarCategory(fromUrl ?? fromQuery ?? null);
  }, [categorySlug, searchParams, setSidebarCategory]);

  const activeCategory = sidebarCategory;
  const isAllCategories = !activeCategory;

  const categoryProducts = useMemo(() => {
    return marketplaceProducts.filter((p) => {
      const matchesCategory =
        !activeCategory || productMatchesCategoryFilter(p, activeCategory);
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.company_name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [marketplaceProducts, activeCategory, searchQuery]);

  const sections = useMemo(() => {
    if (isAllCategories) {
      return groupProductsByMainCategory(categoryProducts);
    }
    if (!activeCategory) return [];
    return groupProductsIntoSections(categoryProducts, activeCategory);
  }, [categoryProducts, activeCategory, isAllCategories]);

  const sectionProducts = useMemo(() => {
    if (!sectionFilter) return [];
    const section = sections.find(
      (s) => s.title.toLowerCase() === sectionFilter.toLowerCase(),
    );
    return section?.products ?? [];
  }, [sections, sectionFilter]);

  const selectCategory = (cat: string | null) => {
    setSidebarCategory(cat);
    setSearchParams({}, { replace: true });
    if (cat) {
      navigate(shopRoutes.category(cat), { replace: true });
    } else {
      navigate(shopRoutes.categories, { replace: true });
    }
  };

  const openSection = (title: string) => {
    setSearchParams({ section: title }, { replace: true });
  };

  const openAllProducts = () => {
    setSearchParams({ view: 'all' }, { replace: true });
  };

  const backToBrowse = () => {
    setSearchParams({}, { replace: true });
  };

  const showSectionDetail = Boolean(sectionFilter);
  const showAllGrid = viewAll && !sectionFilter;

  return (
    <div className="-mx-4 -mt-4 md:mx-0 md:mt-0 flex flex-1 min-h-0 bg-[#f5f5f5] md:rounded-sm md:overflow-hidden md:border md:border-border">
      {/* Sidebar — Jumia-style vertical category list */}
      <aside className="w-[30%] max-w-[120px] sm:max-w-[140px] md:max-w-[160px] shrink-0 bg-white border-r border-border">
        <nav className="flex flex-col">
          {categories.length === 0 && marketplaceLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 rounded bg-background/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className={`relative w-full text-left px-2 py-3 text-[11px] sm:text-xs leading-tight transition-colors border-b border-border/30 ${
                  isAllCategories
                    ? 'bg-background text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-background/60'
                }`}
              >
                {isAllCategories && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
                )}
                All Categories
              </button>
              {categories.map((cat) => {
              const isActive = activeCategory?.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={`relative text-left px-2 py-3 text-[11px] sm:text-xs leading-tight capitalize transition-colors border-b border-border/30 ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-secondary/60'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />
                  )}
                  {cat}
                </button>
              );
            })}
            </>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-3">
          {showSectionDetail ? (
            <SectionProductGrid
              title={sectionFilter ?? ''}
              products={sectionProducts}
              onBack={backToBrowse}
              loading={marketplaceLoading && sectionProducts.length === 0}
            />
          ) : showAllGrid ? (
            <SectionProductGrid
              title={isAllCategories ? 'All Products' : `All ${activeCategory ?? 'Products'}`}
              products={categoryProducts}
              onBack={backToBrowse}
              loading={marketplaceLoading && categoryProducts.length === 0}
            />
          ) : (
            <>
              {/* All Products row */}
              <button
                type="button"
                onClick={openAllProducts}
                className="w-full flex items-center justify-between gap-2 bg-background rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-background/90 transition-colors shadow-sm"
              >
                All Products
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              {marketplaceLoading && categoryProducts.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-background rounded-lg p-3 animate-pulse h-32" />
                  ))}
                </div>
              ) : sections.length === 0 ? (
                <div className="bg-background rounded-lg p-6 text-center text-sm text-muted-foreground">
                  No products in this category yet.
                </div>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.title}
                    className="bg-background rounded-lg p-3 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-foreground capitalize">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => openSection(section.title)}
                        className="text-xs font-medium text-primary hover:underline shrink-0"
                      >
                        See All
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {section.products.slice(0, SECTION_PREVIEW).map((product) => (
                        <CategoryProductTile
                          key={`${product.company_id}-${product.id}`}
                          product={product}
                          companyId={product.company_id ?? ''}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
function SectionProductGrid({
  title,
  products,
  onBack,
  loading,
}: {
  title: string;
  products: ShopProduct[];
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-primary hover:underline shrink-0"
        >
          ← Back
        </button>
        <h1 className="text-sm font-bold text-foreground capitalize truncate">{title}</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-card aspect-[3/4] animate-pulse bg-secondary/50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-background rounded-lg p-6 text-center text-sm text-muted-foreground">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((product) => (
            <ShopProductCard
              key={`${product.company_id}-${product.id}`}
              product={product}
              companyId={product.company_id ?? ''}
              companyName={product.company_name ?? 'Store'}
              showStoreName
            />
          ))}
        </div>
      )}
    </div>
  );
}
