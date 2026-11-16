import React, { useState } from 'react';
import { Lock, MessageCircle, Send } from 'lucide-react';
import { shopApi } from '../../../lib/shopApi';
import { useShopChatRoom } from '../../../hooks/shop/useShopChatRoom';
import { Button } from '../../Button';

interface ChatThread {
  id: string;
  updated_at: string;
  users?: { full_name: string | null; email: string | null } | null;
}

interface CustomerChatTabProps {
  companyId: string;
}

export const CustomerChatTab: React.FC<CustomerChatTabProps> = ({ companyId }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  React.useEffect(() => {
    shopApi
      .getAdminChatThreads()
      .then((res) => setThreads((res.data as ChatThread[]) ?? []))
      .catch(() => setThreads([]))
      .finally(() => setLoadingThreads(false));
  }, [companyId]);

  const { messages, loading, sending, bottomRef, sendMessage } = useShopChatRoom({
    threadId: selectedThreadId ?? undefined,
    mode: 'admin',
    enabled: Boolean(selectedThreadId),
  });

  const handleSend = async () => {
    const ok = await sendMessage(draft);
    if (ok) setDraft('');
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Customer chat</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Encrypted live messages with marketplace customers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[420px]">
        <div className="glass-card overflow-hidden lg:col-span-1">
          <div className="p-3 border-b border-border text-sm font-semibold">Inbox</div>
          <div className="max-h-[360px] overflow-y-auto">
            {loadingThreads && (
              <p className="p-4 text-xs text-muted-foreground animate-pulse">Loading…</p>
            )}
            {!loadingThreads && threads.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">No customer messages yet.</p>
            )}
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-secondary/50 ${
                  selectedThreadId === thread.id ? 'bg-primary/10' : ''
                }`}
              >
                <p className="text-sm font-medium truncate">
                  {thread.users?.full_name ?? thread.users?.email ?? 'Customer'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(thread.updated_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card flex flex-col overflow-hidden lg:col-span-2 min-h-[360px]">
          {!selectedThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
              <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border">
                <p className="text-sm font-semibold">
                  {selectedThread?.users?.full_name ?? selectedThread?.users?.email ?? 'Customer'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && (
                  <p className="text-xs text-muted-foreground text-center py-8 animate-pulse">Loading…</p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-sm rounded-xl px-3 py-2 max-w-[85%] ${
                      msg.sender_role === 'company_admin'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    {msg.body}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  className="input-modern py-2 text-sm flex-1"
                  placeholder="Reply to customer…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} loading={sending} disabled={!draft.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
