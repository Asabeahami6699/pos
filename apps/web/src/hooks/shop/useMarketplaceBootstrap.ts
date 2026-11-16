import { useCallback, useEffect, useRef } from 'react';
import { shopApi } from '../../lib/shopApi';
import {
  getMarketplaceSessionId,
  useEcommerceCatalogStore,
} from '../../stores/ecommerceCatalogStore';
import { useMarketplaceRealtime } from './useMarketplaceRealtime';

/** Loads marketplace catalog once; silent background refresh + live updates */
export function useMarketplaceBootstrap() {
  const marketplaceInitialized = useEcommerceCatalogStore((s) => s.marketplaceInitialized);
  const marketplaceProducts = useEcommerceCatalogStore((s) => s.marketplaceProducts);
  const promotionsInitialized = useEcommerceCatalogStore((s) => s.promotionsInitialized);
  const companiesInitialized = useEcommerceCatalogStore((s) => s.companiesInitialized);

  const setMarketplaceInitialized = useEcommerceCatalogStore((s) => s.setMarketplaceInitialized);
  const setMarketplaceProducts = useEcommerceCatalogStore((s) => s.setMarketplaceProducts);
  const setMarketplaceLoading = useEcommerceCatalogStore((s) => s.setMarketplaceLoading);
  const setMarketplaceError = useEcommerceCatalogStore((s) => s.setMarketplaceError);
  const setCategories = useEcommerceCatalogStore((s) => s.setCategories);
  const setPromotions = useEcommerceCatalogStore((s) => s.setPromotions);
  const setPromotionsLoading = useEcommerceCatalogStore((s) => s.setPromotionsLoading);
  const setPromotionsInitialized = useEcommerceCatalogStore((s) => s.setPromotionsInitialized);
  const setCompanies = useEcommerceCatalogStore((s) => s.setCompanies);
  const setCompaniesLoading = useEcommerceCatalogStore((s) => s.setCompaniesLoading);
  const setCompaniesError = useEcommerceCatalogStore((s) => s.setCompaniesError);
  const setCompaniesInitialized = useEcommerceCatalogStore((s) => s.setCompaniesInitialized);

  const catalogLoadingRef = useRef(false);

  const loadCatalog = useCallback(
    async (options?: { silent?: boolean }) => {
      const hasCache = marketplaceProducts.length > 0;
      const silent = options?.silent ?? hasCache;

      if (catalogLoadingRef.current) return;
      catalogLoadingRef.current = true;

      if (!silent) {
        setMarketplaceLoading(true);
        setMarketplaceError(null);
      }

      try {
        const [productsRes, categoriesRes] = await Promise.all([
          shopApi.getAllProducts(),
          shopApi.getCategories().catch(() => ({ data: [] as string[] })),
        ]);
        setMarketplaceProducts(productsRes.data);
        setCategories(categoriesRes.data ?? []);
        setMarketplaceInitialized(true);
      } catch (e) {
        if (!silent) {
          setMarketplaceError(e instanceof Error ? e.message : 'Failed to load marketplace');
        }
      } finally {
        if (!silent) setMarketplaceLoading(false);
        catalogLoadingRef.current = false;
      }
    },
    [
      marketplaceProducts.length,
      setMarketplaceProducts,
      setMarketplaceLoading,
      setMarketplaceError,
      setCategories,
      setMarketplaceInitialized,
    ],
  );

  const loadPromotions = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? promotionsInitialized;
      if (!silent) setPromotionsLoading(true);
      try {
        const sessionId = getMarketplaceSessionId();
        const res = await shopApi.getPromotions(sessionId);
        setPromotions(res.data ?? []);
        setPromotionsInitialized(true);
      } catch {
        if (!promotionsInitialized) setPromotions([]);
      } finally {
        if (!silent) setPromotionsLoading(false);
      }
    },
    [promotionsInitialized, setPromotions, setPromotionsLoading, setPromotionsInitialized],
  );

  const loadCompanies = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? companiesInitialized;
      if (!silent) setCompaniesLoading(true);
      try {
        const res = await shopApi.getCompanies();
        setCompanies(res.data);
        setCompaniesInitialized(true);
      } catch (e) {
        if (!silent) {
          setCompaniesError(e instanceof Error ? e.message : 'Failed to load stores');
        }
      } finally {
        if (!silent) setCompaniesLoading(false);
      }
    },
    [
      companiesInitialized,
      setCompanies,
      setCompaniesLoading,
      setCompaniesError,
      setCompaniesInitialized,
    ],
  );

  useEffect(() => {
    if (!marketplaceInitialized) {
      loadCatalog({ silent: false });
    }
    if (!promotionsInitialized) {
      loadPromotions({ silent: false });
    }
  }, [marketplaceInitialized, promotionsInitialized, loadCatalog, loadPromotions]);

  useMarketplaceRealtime(() => {
    loadCatalog({ silent: true });
    loadPromotions({ silent: true });
  });

  const ensureCompanies = useCallback(() => {
    if (!useEcommerceCatalogStore.getState().companiesInitialized) {
      loadCompanies({ silent: false });
    }
  }, [loadCompanies]);

  return {
    loadCatalog,
    loadPromotions,
    loadCompanies,
    ensureCompanies,
  };
}

export async function trackProductClick(params: {
  productId: string;
  companyId: string;
  category?: string | null;
}) {
  try {
    await shopApi.trackClick({
      product_id: params.productId,
      company_id: params.companyId,
      category: params.category ?? undefined,
      session_id: getMarketplaceSessionId(),
    });
  } catch {
    /* non-blocking */
  }
}

/** Load store catalog into zustand; skips loading flash if cached unless force */
export function useStoreCatalog(companyId: string | undefined) {
  const storeProducts = useEcommerceCatalogStore((s) =>
    companyId ? s.storeProducts[companyId] : undefined,
  );
  const storeCompany = useEcommerceCatalogStore((s) =>
    companyId ? s.storeCompany[companyId] : null,
  );
  const storeLoading = useEcommerceCatalogStore((s) =>
    companyId ? s.storeLoading[companyId] : false,
  );
  const lastUpdated = useEcommerceCatalogStore((s) =>
    companyId ? s.lastUpdated[companyId] : undefined,
  );
  const setStoreCatalog = useEcommerceCatalogStore((s) => s.setStoreCatalog);
  const setStoreLoading = useEcommerceCatalogStore((s) => s.setStoreLoading);
  const loadingRef = useRef(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (!companyId || loadingRef.current) return;
      const hasCache = (storeProducts?.length ?? 0) > 0;

      loadingRef.current = true;
      if (!silent && !hasCache) setStoreLoading(companyId, true);

      try {
        const res = await shopApi.getStoreProducts(companyId);
        setStoreCatalog(companyId, res.data.company, res.data.products);
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent && !hasCache) setStoreLoading(companyId, false);
        loadingRef.current = false;
      }
    },
    [companyId, storeProducts?.length, setStoreCatalog, setStoreLoading],
  );

  useEffect(() => {
    if (!companyId) return;
    const hasCache = (storeProducts?.length ?? 0) > 0;
    refresh(hasCache);
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    company: storeCompany,
    products: storeProducts ?? [],
    loading: storeLoading && (storeProducts?.length ?? 0) === 0,
    updated: lastUpdated,
    refresh: () => refresh(false),
    refreshSilent: () => refresh(true),
  };
}
