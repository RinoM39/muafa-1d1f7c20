-- Enable realtime for wallets so balance updates push to the client
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;

-- Also enable realtime for wallet_requests so users see status changes live
ALTER TABLE public.wallet_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_requests;