import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shopApi } from '../../lib/shopApi';
import { shopRoutes } from '../../lib/roleRedirect';

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

/** Floating chat launcher — opens messages panel with back navigation */
export const ShopChatWidget: React.FC<ShopChatWidgetProps> = ({ companyId, companyName }) => {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (open) void loadThreads();
  }, [open, loadThreads]);

  const closePanel = () => setOpen(false);

  const openChat = () => {
    if (companyId) {
      navigate(shopRoutes.chatRoom(companyId), { state: { companyName } });
      return;
    }
    setOpen(true);
  };

  const openThread = (thread: ChatThreadSummary) => {
    closePanel();
    navigate(shopRoutes.chatRoom(thread.company_id), {
      state: { companyName: thread.companies?.name ?? 'Store' },
    });
  };

  if (!signedIn) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openChat}
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
              inset-x-0 bottom-0 max-h-[min(85vh,520px)] rounded-t-2xl safe-area-pb safe-area-px
              md:inset-auto md:right-4 md:bottom-6 md:w-[min(100vw-2rem,380px)] md:max-h-[min(70vh,520px)] md:rounded-xl"
            role="dialog"
            aria-label="Messages"
          >
            <header className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
              <button
                type="button"
                onClick={closePanel}
                className="p-2 rounded-lg hover:bg-secondary text-foreground"
                aria-label="Back to marketplace"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground">Messages</h2>
                <p className="text-[10px] text-muted-foreground">Encrypted chats with sellers</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {loading && (
                <p className="text-sm text-muted-foreground text-center py-10 animate-pulse">Loading…</p>
              )}

              {!loading && threads.length === 0 && (
                <div className="text-center py-10 px-4 space-y-2">
                  <MessageCircle className="w-9 h-9 text-muted-foreground mx-auto opacity-60" />
                  <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Open a store or product page and tap &quot;Chat with seller&quot; to start.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => openThread(thread)}
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
            </div>
          </div>
        </>
      )}
    </>
  );
};
