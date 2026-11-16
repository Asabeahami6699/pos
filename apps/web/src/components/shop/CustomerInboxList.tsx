import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { shopRoutes } from '../../lib/roleRedirect';

interface ChatThreadSummary {
  id: string;
  company_id: string;
  updated_at: string;
  companies?: { name: string } | null;
}

export const CustomerInboxList: React.FC = () => {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shopApi
      .getChatThreads()
      .then((res) => setThreads((res.data as ChatThreadSummary[]) ?? []))
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">Loading…</p>;
  }

  if (threads.length === 0) {
    return (
      <div className="glass-card p-8 text-center space-y-2">
        <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No messages yet.</p>
        <Link to={shopRoutes.home} className="text-sm text-primary hover:underline">
          Browse marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <Link
          key={thread.id}
          to={shopRoutes.chatRoom(thread.company_id)}
          state={{ companyName: thread.companies?.name ?? 'Store' }}
          className="glass-card p-4 flex items-center justify-between gap-3 hover:bg-secondary/50 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{thread.companies?.name ?? 'Store'}</p>
            <p className="text-[10px] text-muted-foreground">
              Updated {new Date(thread.updated_at).toLocaleString()}
            </p>
          </div>
          <MessageCircle className="w-5 h-5 text-primary shrink-0" />
        </Link>
      ))}
    </div>
  );
};
