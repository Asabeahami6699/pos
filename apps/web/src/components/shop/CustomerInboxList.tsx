import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, Store } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import type { ShopCompany } from '../../stores/ecommerceCatalogStore';
import { useShopChatUiStore } from '../../stores/shopChatUiStore';
import { Button } from '../Button';
import { Input } from '../Input';

interface ChatThreadSummary {
  id: string;
  company_id: string;
  updated_at: string;
  companies?: { name: string } | null;
}

export const CustomerInboxList: React.FC = () => {
  const openRoom = useShopChatUiStore((s) => s.openRoom);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [stores, setStores] = useState<ShopCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickingStore, setPickingStore] = useState(false);
  const [storeQuery, setStoreQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [threadRes, companyRes] = await Promise.all([
          shopApi.getChatThreads().catch(() => ({ data: [] as ChatThreadSummary[] })),
          shopApi.getCompanies().catch(() => ({ data: [] as ShopCompany[] })),
        ]);
        if (cancelled) return;
        setThreads((threadRes.data as ChatThreadSummary[]) ?? []);
        setStores((companyRes.data as ShopCompany[]) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q),
    );
  }, [stores, storeQuery]);

  if (loading) {
    return <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Chats open in the floating messages panel — pick a store to start typing.
        </p>
        <Button
          size="sm"
          variant={pickingStore ? 'secondary' : 'primary'}
          onClick={() => setPickingStore((v) => !v)}
        >
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
          {pickingStore ? 'Hide stores' : 'Message a store'}
        </Button>
      </div>

      {pickingStore && (
        <div className="glass-card p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
              placeholder="Search stores…"
              className="!pl-9"
            />
          </div>
          {filteredStores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No stores found.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[22rem] overflow-y-auto">
              {filteredStores.map((store) => (
                <li key={store.id}>
                  <button
                    type="button"
                    onClick={() => openRoom(store.id, store.name)}
                    className="w-full text-left glass-card p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors border border-border"
                  >
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{store.name}</span>
                      {store.location && (
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {store.location}
                        </span>
                      )}
                    </span>
                    <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {threads.length === 0 && !pickingStore ? (
        <div className="glass-card p-8 text-center space-y-3">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto opacity-60" />
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Tap <strong>Message a store</strong> to open the floating chat and write a seller.
          </p>
          <Button size="sm" onClick={() => setPickingStore(true)}>
            Message a store
          </Button>
        </div>
      ) : threads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => openRoom(thread.company_id, thread.companies?.name ?? 'Store')}
              className="glass-card p-4 flex items-center justify-between gap-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {thread.companies?.name ?? 'Store'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Updated {new Date(thread.updated_at).toLocaleString()}
                </p>
              </div>
              <MessageCircle className="w-5 h-5 text-primary shrink-0" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
