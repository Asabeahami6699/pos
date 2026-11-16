import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { shopApi } from '../../lib/shopApi';

export interface ChatMessage {
  id: string;
  sender_role: string;
  body: string;
  created_at: string;
}

interface UseShopChatRoomOptions {
  companyId?: string;
  threadId?: string;
  mode: 'customer' | 'admin';
  enabled?: boolean;
}

export function useShopChatRoom({
  companyId,
  threadId: adminThreadId,
  mode,
  enabled = true,
}: UseShopChatRoomOptions) {
  const [threadId, setThreadId] = useState<string | null>(adminThreadId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!enabled) return;

    try {
      if (mode === 'customer' && companyId) {
        const res = await shopApi.getChat(companyId);
        setThreadId(res.data.thread_id);
        setMessages((res.data.messages as ChatMessage[]) ?? []);
      } else if (mode === 'admin' && adminThreadId) {
        const res = await shopApi.getAdminChatMessages(adminThreadId);
        setMessages((res.data as ChatMessage[]) ?? []);
        setThreadId(adminThreadId);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [enabled, mode, companyId, adminThreadId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!enabled || !threadId) return;

    const channel = supabase
      .channel(`shop-chat-thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shop_chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          loadMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, threadId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (body: string) => {
    const text = body.trim();
    if (!text) return false;

    setSending(true);
    try {
      if (mode === 'customer' && companyId) {
        await shopApi.sendChatMessage(companyId, text);
      } else if (mode === 'admin' && adminThreadId) {
        await shopApi.sendAdminChatMessage(adminThreadId, text);
      } else {
        return false;
      }
      await loadMessages();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      return false;
    } finally {
      setSending(false);
    }
  };

  return {
    threadId,
    messages,
    loading,
    sending,
    error,
    bottomRef,
    sendMessage,
    refresh: loadMessages,
  };
}
