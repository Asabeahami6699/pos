import React from 'react';
import { CloudOff, Cloud, RefreshCw, Clock } from 'lucide-react';
import { Button } from '../Button';

interface OfflineStatusBannerProps {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  online,
  pendingCount,
  syncing,
  onSync,
}) => {
  if (online && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 text-xs border-b ${
        online
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
          : 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {online ? (
          <Clock className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="font-medium truncate">
          {!online
            ? 'Offline mode — sales saved locally'
            : `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} waiting to sync`}
        </span>
      </div>
      {online && pendingCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 h-7 text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Sync now
        </Button>
      )}
      {online && pendingCount === 0 && <Cloud className="w-3.5 h-3.5 shrink-0 opacity-60" />}
    </div>
  );
};
