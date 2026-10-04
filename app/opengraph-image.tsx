import { SHARE_ALT, SHARE_SIZE, shareImage } from "@/lib/og/share-image";

export const alt = SHARE_ALT;
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The image shown when any page of the site is shared (LinkedIn, WhatsApp, Facebook…). */
export default function OpenGraphImage() {
  return shareImage();
}
