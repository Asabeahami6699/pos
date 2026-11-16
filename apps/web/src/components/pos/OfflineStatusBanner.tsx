import React from 'react';
import { CloudOff, Cloud, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../Button';

interface OfflineStatusBannerProps {
  online: boolean;
  pendingCount: number;
  conflictCount?: number;
  syncing: boolean;
  onSync: () => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  online,
  pendingCount,
  conflictCount = 0,
  syncing,
  onSync,
}) => {
  if (online && pendingCount === 0) return null;

  const hasConflict = conflictCount > 0;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 text-xs border-b ${
        !online
          ? 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-200'
          : hasConflict
            ? 'bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-200'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!online ? (
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
        ) : hasConflict ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="font-medium truncate">
          {!online
            ? 'Offline mode — sales saved locally (best effort until sync)'
            : hasConflict
              ? `${conflictCount} sale${conflictCount !== 1 ? 's' : ''} blocked by stock conflict — refresh stock, adjust qty, then Sync`
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
