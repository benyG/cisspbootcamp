import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest — today the Google refresh token, which
 * grants standing access to Ben's calendar and must not sit in clear text
 * in a database whose backups we do not control.
 *
 * Key: 32 bytes, base64, in GOOGLE_TOKEN_ENCRYPTION_KEY. Output is
 * `iv.ciphertext.tag`, all base64url, so it fits a VARCHAR and survives
 * copy-paste.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function loadKey(encoded: string | undefined): Buffer {
  if (!encoded) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY manquante (32 octets en base64).");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY doit faire 32 octets une fois décodée, pas ${key.length}.`,
    );
  }
  return key;
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, ciphertext, tag].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(sealed: string, key: Buffer): string {
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("Valeur chiffrée malformée.");

  const [iv, ciphertext, tag] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
