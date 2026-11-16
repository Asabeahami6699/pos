import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RealTimeIndicatorProps {
  companyId?: string | null;
}

export const RealTimeIndicator: React.FC<RealTimeIndicatorProps> = ({ companyId }) => {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setStatus('offline');
      return;
    }

    if (!companyId) {
      setStatus('connecting');
      return;
    }

    const channel = supabase
      .channel(`live-indicator:${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `company_id=eq.${companyId}` },
        () => {}
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') setStatus('connected');
        else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setStatus('offline');
        } else {
          setStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, isOnline]);

  const config = {
    connected: { color: 'bg-success', label: 'Live updates active', Icon: Wifi },
    connecting: { color: 'bg-amber-500/100/100 animate-pulse', label: 'Connecting...', Icon: Wifi },
    offline: { color: 'bg-destructive', label: 'Offline', Icon: WifiOff },
  }[status];

  const { color, label, Icon } = config;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-white/5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
};
