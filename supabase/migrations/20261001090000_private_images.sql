-- v2: receipts and avatars are no longer public.
--
-- v1's bucket was public: anyone with a file's URL could open it, with no
-- sign-in. The app now shows every image through a signed link that works for
-- one hour, created for the signed-in owner (the "view their own" SELECT
-- policy from 20260929100000). Uploads store the file's path; v1's stored
-- public URLs still work because the app reads the path out of them.
--
-- Deploy the app first (it already uses signed links while the bucket is
-- public), then run this.

UPDATE storage.buckets SET public = false WHERE id = 'expense-images';
