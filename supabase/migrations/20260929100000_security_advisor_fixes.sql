-- v2 / Phase 0: fixes for two Supabase Security Advisor warnings.
--
-- 1. "Public Bucket Allows Listing" (storage.expense-images)
--    v1's SELECT policy let anyone with the app's public key list every file
--    in the bucket, i.e. every user's receipts and avatars. Public URLs don't
--    need a SELECT policy (the bucket is public), so images keep showing; only
--    listing is limited to the user's own folder. The UPDATE policy lets the
--    avatar upload (upsert) replace the user's existing avatar file.
--
-- 2. "Public / Signed-In Users Can Execute SECURITY DEFINER Function"
--    handle_new_user() only runs as the on_auth_user_created trigger. Nobody
--    needs to call it through the API; the trigger keeps working without it.

DROP POLICY "Users can view expense images" ON storage.objects;

CREATE POLICY "Users can view their own expense images" ON storage.objects
  FOR SELECT USING (bucket_id = 'expense-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own expense images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'expense-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'expense-images' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
