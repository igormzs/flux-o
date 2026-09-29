import { supabase } from "@/integrations/supabase/client";

/** Receipts and avatars, one folder per user (`<user id>/...`). Private. */
export const IMAGE_BUCKET = "expense-images";

/** How long a signed link to an image works. */
export const SIGNED_URL_SECONDS = 60 * 60;

const PUBLIC_PREFIX = `/storage/v1/object/public/${IMAGE_BUCKET}/`;

/**
 * The file path inside the bucket for a stored image value, or null for
 * anything that isn't in the bucket (a local preview, an external avatar).
 * v1 and early v2 stored full public URLs; uploads now store the path.
 * A `?t=` query (the avatar's cache buster) is ignored.
 */
export function storagePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(blob|data):/.test(value)) return null;
  if (/^https?:\/\//.test(value)) {
    const url = new URL(value);
    const i = url.pathname.indexOf(PUBLIC_PREFIX);
    return i === -1 ? null : decodeURIComponent(url.pathname.slice(i + PUBLIC_PREFIX.length));
  }
  return value.split("?")[0] || null;
}

/** A link that shows the image, signed for the owner (the bucket is private). */
export async function imageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = storagePath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/** Upload to the user's folder and return the stored value (the path). */
export async function uploadImage(file: File, name: string, upsert = false): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const path = `${user.id}/${name}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert });
  if (error) throw error;
  return path;
}

/** Delete every receipt in the user's folder (the avatar stays). */
export async function deleteReceipts(userId: string): Promise<void> {
  const bucket = supabase.storage.from(IMAGE_BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    const names = (data ?? []).filter((f) => f.id && !f.name.startsWith("avatar.")).map((f) => `${userId}/${f.name}`);
    if (names.length === 0) return;
    const { data: removed, error: removeError } = await bucket.remove(names);
    if (removeError) throw removeError;
    if (!removed?.length) throw new Error("Couldn't delete the receipts");
  }
}
