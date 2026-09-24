import { prisma } from "@/lib/db";

/**
 * Message templates (SPECS A8/A9): stored in message_templates, edited from
 * /admin/parametres/gabarits, rendered with {{placeholders}}.
 *
 * WhatsApp in V1 is a wa.me link Ben opens from the queue — one click, and
 * he presses send himself. Nothing is sent to a prospect without a human.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

/** Replace {{name}} markers; unknown markers are left visible so a typo shows. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? match : String(value);
  });
}

/** https://wa.me/221771234567?text=… — number without "+", text URL-encoded. */
export function waMeLink(whatsapp: string, text: string): string {
  const digits = whatsapp.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function loadTemplate(key: string): Promise<{ subject: string | null; body: string } | null> {
  const row = await prisma.messageTemplate.findUnique({ where: { key } });
  return row ? { subject: row.subject, body: row.body } : null;
}

/** Standard variables every template may use for a lead. */
export function leadVars(input: {
  firstName: string;
  lastName: string;
  appUrl: string;
  resultToken?: string | null;
  cohortName?: string | null;
  cohortMonth?: string | null;
  paymentUrl?: string | null;
}): TemplateVars {
  return {
    prenom: input.firstName,
    nom: input.lastName,
    lien_rdv: input.resultToken ? `${input.appUrl}/rdv?t=${input.resultToken}` : `${input.appUrl}/rdv`,
    lien_resultat: input.resultToken ? `${input.appUrl}/scanner/resultat/${input.resultToken}` : null,
    cohorte: input.cohortName ?? null,
    mois_cohorte: input.cohortMonth ?? null,
    lien_paiement: input.paymentUrl ?? (input.resultToken ? `${input.appUrl}/inscription?t=${input.resultToken}` : null),
    lien_test: input.resultToken ? `${input.appUrl}/test-cissp?t=${input.resultToken}&from=relance` : null,
    lien_conseil: input.resultToken ? `${input.appUrl}/conseil?t=${input.resultToken}` : `${input.appUrl}/conseil`,
  };
}
