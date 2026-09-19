/**
 * Whether an address is the single admin allowed into /admin.
 *
 * Pure and case-insensitive, kept apart from auth.ts so it can be tested
 * without booting NextAuth.
 */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmail: string,
): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}
