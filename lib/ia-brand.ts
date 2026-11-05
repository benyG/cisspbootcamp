/**
 * Who speaks for the Bâtisseur IA (Ben, 05/11): a training by ExamBoot, the
 * company, followed by its team. The CISSP side stays personal (Ben, the
 * coach); the IA side never names him. Pure: pages, e-mails and receipts.
 */

export const IA_COMPANY = "ExamBoot";
export const IA_TEAM = "L’équipe Bâtisseur IA";
/** Closing lines of every Bâtisseur IA e-mail. */
export const IA_SIGNATURE = `${IA_TEAM}\n${IA_COMPANY}`;
/** Display name of the sender of Bâtisseur IA e-mails. */
export const IA_SENDER = `Bâtisseur IA · ${IA_COMPANY}`;
/** Issuer on a Bâtisseur IA receipt. */
export const IA_ISSUER = `${IA_COMPANY} — Bâtisseur IA`;

/** The signature of a programme's e-mails: the IA team, or the given CISSP one. */
export function signatureFor(program: string, cissp: string): string {
  return program === "ia" ? IA_SIGNATURE : cissp;
}

/** The sender name of a programme's e-mails, or undefined to keep the default. */
export function senderFor(program: string): string | undefined {
  return program === "ia" ? IA_SENDER : undefined;
}

/** "Name <address>" with another display name; the address is kept. */
export function withSenderName(from: string, name: string | undefined): string {
  if (!name) return from;
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  return `${name.replace(/[<>"]/g, "")} <${address}>`;
}
