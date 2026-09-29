import { useQuery } from "@tanstack/react-query";
import { imageUrl, SIGNED_URL_SECONDS, storagePath } from "@/lib/storage";

/**
 * A displayable URL for a stored image (receipt or avatar). Images in the
 * private bucket get a signed link, cached until shortly before it expires.
 * Local previews and external URLs are returned as they are.
 */
export const useImageUrl = (value: string | null | undefined): string | undefined => {
  const path = storagePath(value);
  const { data } = useQuery({
    queryKey: ["image-url", value],
    enabled: !!path,
    queryFn: () => imageUrl(value),
    staleTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
    gcTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
  });
  if (!value) return undefined;
  return path ? data ?? undefined : value;
};
