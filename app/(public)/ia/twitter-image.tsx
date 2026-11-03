import { IA_SHARE_ALT, iaShareImage } from "@/lib/og/ia-share-image";
import { SHARE_SIZE } from "@/lib/og/share-image";

export const alt = IA_SHARE_ALT;
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The image shown when a Bâtisseur IA page is shared. */
export default function Image() {
  return iaShareImage();
}
