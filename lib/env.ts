import { z } from "zod";

/**
 * Environment contract. Fails fast at boot rather than at the first query,
 * so a missing secret never surfaces as a mystery 500 in production.
 *
 * Only the variables needed by shipped features are required; the rest are
 * added as their step lands (see CLAUDE.md, ordre de développement).
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement invalides ou manquantes :\n${details}\n` +
        "Voir .env.example.",
    );
  }
  return parsed.data;
}

export const env = load();
