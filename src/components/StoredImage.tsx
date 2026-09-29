import type { ImgHTMLAttributes, ReactNode } from "react";
import { useImageUrl } from "@/hooks/useImageUrl";

interface StoredImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** The stored value: a bucket path, a v1 public URL, a local preview or an external URL. */
  value: string | null | undefined;
  /** Shown while there's no image (none stored, or its link is still loading). */
  fallback?: ReactNode;
}

/** An image from the private bucket, shown through a signed link. */
const StoredImage = ({ value, fallback = null, alt = "", ...props }: StoredImageProps) => {
  const src = useImageUrl(value);
  return src ? <img src={src} alt={alt} {...props} /> : <>{fallback}</>;
};

export default StoredImage;
