-- Enable realtime for live customer ↔ store chat

ALTER TABLE public.shop_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.shop_chat_threads REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_chat_threads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
