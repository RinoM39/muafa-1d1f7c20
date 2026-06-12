
-- Admin moderation on ratings
CREATE POLICY "ratings_admin_all"
ON public.ratings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Tighten wallet_requests insert: validate amount range
DROP POLICY IF EXISTS "wallet_req_insert_self" ON public.wallet_requests;
CREATE POLICY "wallet_req_insert_self"
ON public.wallet_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND amount > 0
  AND amount <= 1000000
);
