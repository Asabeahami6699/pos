import React, { useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { useShopChatRoom } from '../../hooks/shop/useShopChatRoom';
import { Button } from '../../components/Button';
import { shopRoutes } from '../../lib/roleRedirect';

export const ShopChatRoomPage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const companyName =
    (location.state as { companyName?: string } | null)?.companyName ?? 'Store';

  const [draft, setDraft] = useState('');
  const { messages, loading, sending, error, bottomRef, sendMessage } = useShopChatRoom({
    companyId,
    mode: 'customer',
    enabled: Boolean(companyId),
  });

  const handleSend = async () => {
    const ok = await sendMessage(draft);
    if (ok) setDraft('');
  };

  if (!companyId) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Invalid chat room.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col md:static md:z-auto md:max-w-lg md:mx-auto md:min-h-[70vh] md:rounded-xl md:overflow-hidden md:border md:border-border md:shadow-lg">
      <header className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border glass-card rounded-none safe-area-pt safe-area-px">
        <button
          type="button"
          onClick={() => navigate(shopRoutes.home)}
          className="p-2 rounded-lg hover:bg-secondary"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-foreground truncate">{companyName}</h1>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Encrypted · Live chat
          </p>
        </div>
        <Link to={shopRoutes.store(companyId)} className="text-xs text-primary hover:underline shrink-0">
          View store
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {loading && (
          <p className="text-center text-sm text-muted-foreground animate-pulse py-12">Loading chat…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-12">
            Ask about products, delivery, or your order. Messages are encrypted end-to-end on our servers.
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

      {error && (
        <p className="px-4 py-1 text-xs text-destructive text-center">{error}</p>
      )}

      <div className="shrink-0 p-3 border-t border-border flex gap-2 safe-area-pb safe-area-px">
        <input
          className="input-modern py-2.5 text-sm flex-1"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <Button onClick={handleSend} loading={sending} disabled={!draft.trim()} aria-label="Send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
