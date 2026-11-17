import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, MessageCircle, Search, Send, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shopApi } from '../../lib/shopApi';
import { shopRoutes } from '../../lib/roleRedirect';
import type { ShopCompany } from '../../stores/ecommerceCatalogStore';
import { useShopChatUiStore } from '../../stores/shopChatUiStore';
import { useShopChatRoom } from '../../hooks/shop/useShopChatRoom';
import { Button } from '../Button';

interface ShopChatWidgetProps {
  companyId?: string;
  companyName?: string;
}

interface ChatThreadSummary {
  id: string;
  company_id: string;
  updated_at: string;
  companies?: { name: string } | null;
}

/** Floating chat — threads, store picker, and live room in one panel */
export const ShopChatWidget: React.FC<ShopChatWidgetProps> = ({
  companyId: propCompanyId,
  companyName: propCompanyName,
}) => {
  const open = useShopChatUiStore((s) => s.open);
  const view = useShopChatUiStore((s) => s.view);
  const roomCompanyId = useShopChatUiStore((s) => s.companyId);
  const roomCompanyName = useShopChatUiStore((s) => s.companyName);
  const openPanel = useShopChatUiStore((s) => s.openPanel);
  const closePanel = useShopChatUiStore((s) => s.closePanel);
  const showThreads = useShopChatUiStore((s) => s.showThreads);
  const showStores = useShopChatUiStore((s) => s.showStores);
  const openRoom = useShopChatUiStore((s) => s.openRoom);

  const [signedIn, setSignedIn] = useState(false);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [stores, setStores] = useState<ShopCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeQuery, setStoreQuery] = useState('');
  const [draft, setDraft] = useState('');

  const {
    messages,
    loading: roomLoading,
    sending,
    error: roomError,
    bottomRef,
    sendMessage,
  } = useShopChatRoom({
    companyId: roomCompanyId ?? undefined,
    mode: 'customer',
    enabled: open && view === 'room' && Boolean(roomCompanyId),
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setSignedIn(profile?.role === 'customer');
    });
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getChatThreads();
      setThreads((res.data as ChatThreadSummary[]) ?? []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    try {
      const res = await shopApi.getCompanies();
      setStores((res.data as ShopCompany[]) ?? []);
    } catch {
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (view === 'threads') {
      setStoreQuery('');
      void loadThreads();
    }
  }, [open, view, loadThreads]);

  useEffect(() => {
    if (open && view === 'stores') {
      void loadStores();
    }
  }, [open, view, loadStores]);

  useEffect(() => {
    if (view !== 'room') setDraft('');
  }, [view, roomCompanyId]);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q),
    );
  }, [stores, storeQuery]);

  const handleFabClick = () => {
    if (propCompanyId) {
      openRoom(propCompanyId, propCompanyName);
      return;
    }
    openPanel();
  };

  const handleBack = () => {
    if (view === 'room' || view === 'stores') {
      showThreads();
      void loadThreads();
      return;
    }
    closePanel();
  };

  const handleSend = async () => {
    const ok = await sendMessage(draft);
    if (ok) setDraft('');
  };

  if (!signedIn) return null;

  const headerTitle =
    view === 'room'
      ? roomCompanyName ?? 'Store'
      : view === 'stores'
        ? 'Message a store'
        : 'Messages';
  const headerSubtitle =
    view === 'room'
      ? 'Encrypted · Live chat'
      : view === 'stores'
        ? 'Pick a seller to start chatting'
        : 'Encrypted chats with sellers';

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={handleFabClick}
          className="fixed shop-fab-bottom z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 safe-area-right"
          aria-label="Open chat"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:bg-black/25"
            aria-label="Close chat"
            onClick={closePanel}
          />

          <div
            className="fixed z-50 flex flex-col bg-background border border-border shadow-2xl overflow-hidden
              inset-x-0 bottom-0 h-[min(88vh,640px)] max-h-[min(88vh,640px)] rounded-t-2xl safe-area-pb safe-area-px
              md:inset-auto md:right-4 md:bottom-6 md:w-[min(100vw-2rem,400px)] md:h-[min(75vh,620px)] md:max-h-[min(75vh,620px)] md:rounded-xl"
            role="dialog"
            aria-label="Messages"
          >
            <header className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
              <button
                type="button"
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-secondary text-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">{headerTitle}</h2>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {view === 'room' && <Lock className="w-3 h-3" />}
                  {headerSubtitle}
                </p>
              </div>
              {view === 'threads' && (
                <button
                  type="button"
                  onClick={showStores}
                  className="text-[11px] font-semibold text-primary hover:underline shrink-0 px-1"
                >
                  New chat
                </button>
              )}
              {view === 'room' && roomCompanyId && (
                <Link
                  to={shopRoutes.store(roomCompanyId)}
                  onClick={closePanel}
                  className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                >
                  View store
                </Link>
              )}
            </header>

            {view === 'threads' && (
              <div className="flex-1 overflow-y-auto p-3 min-h-0">
                {loading && (
                  <p className="text-sm text-muted-foreground text-center py-10 animate-pulse">
                    Loading…
                  </p>
                )}

                {!loading && threads.length === 0 && (
                  <div className="text-center py-8 px-4 space-y-3">
                    <MessageCircle className="w-9 h-9 text-muted-foreground mx-auto opacity-60" />
                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                    <button
                      type="button"
                      onClick={showStores}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 hover:opacity-90"
                    >
                      <Store className="w-4 h-4" />
                      Message a store
                    </button>
                  </div>
                )}

                {!loading && threads.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={showStores}
                      className="w-full text-left rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 flex items-center gap-2 hover:bg-primary/10 transition-colors"
                    >
                      <Store className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-primary">Message a store</span>
                    </button>
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() =>
                          openRoom(thread.company_id, thread.companies?.name ?? 'Store')
                        }
                        className="w-full text-left glass-card p-3 flex items-center justify-between gap-3 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {thread.companies?.name ?? 'Store'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Updated {new Date(thread.updated_at).toLocaleString()}
                          </p>
                        </div>
                        <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'stores' && (
              <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={storeQuery}
                    onChange={(e) => setStoreQuery(e.target.value)}
                    placeholder="Search stores…"
                    className="input-modern !pl-9 py-2.5 text-sm"
                    autoFocus
                  />
                </div>

                {storesLoading && (
                  <p className="text-sm text-muted-foreground text-center py-8 animate-pulse">
                    Loading stores…
                  </p>
                )}

                {!storesLoading && filteredStores.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No stores found.</p>
                )}

                {!storesLoading &&
                  filteredStores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => openRoom(store.id, store.name)}
                      className="w-full text-left glass-card p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
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
                  ))}
              </div>
            )}

            {view === 'room' && roomCompanyId && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {roomLoading && (
                    <p className="text-center text-sm text-muted-foreground animate-pulse py-12">
                      Loading chat…
                    </p>
                  )}
                  {!roomLoading && messages.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-12 px-4">
                      Ask about products, delivery, or your order. Type below to send the first
                      message.
                    </p>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-sm rounded-xl px-3 py-2 max-w-[85%] ${
                        msg.sender_role === 'customer'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {msg.body}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {roomError && (
                  <p className="px-3 py-1 text-xs text-destructive text-center shrink-0">
                    {roomError}
                  </p>
                )}

                <div className="shrink-0 p-3 border-t border-border flex gap-2">
                  <input
                    className="input-modern py-2.5 text-sm flex-1"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    onClick={() => void handleSend()}
                    loading={sending}
                    disabled={!draft.trim()}
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};
