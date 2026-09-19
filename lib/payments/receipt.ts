import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatUsdCents } from "@/lib/pricing";

/**
 * Receipt PDF — SPECS A4. pdf-lib rather than a headless browser: pure JS,
 * runs in a serverless function, no Chromium to ship.
 */
export type ReceiptData = {
  reference: string;
  paidAt: Date;
  method: "stripe" | "netticket";
  amountUsdCents: number;
  amountLocalLabel: string | null;
  participantName: string;
  participantEmail: string;
  company: string | null;
  cohortName: string;
  issuerName: string;
  issuerEmail: string;
};

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.28, 0.33, 0.41);
  const accent = rgb(0.06, 0.46, 0.43);

  let y = 780;
  const text = (value: string, options: { size?: number; font?: typeof regular; color?: typeof ink; x?: number } = {}) => {
    page.drawText(value, { x: options.x ?? 56, y, size: options.size ?? 11, font: options.font ?? regular, color: options.color ?? ink });
  };

  text("REÇU", { size: 22, font: bold, color: accent });
  y -= 18;
  text(`N° ${data.reference}`, { color: muted });
  y -= 14;
  text(`Émis le ${data.paidAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, { color: muted });

  y -= 40;
  text("Émetteur", { font: bold, size: 10, color: muted });
  y -= 16;
  text(data.issuerName, { font: bold });
  y -= 14;
  text(data.issuerEmail, { color: muted });

  y -= 30;
  text("Participant", { font: bold, size: 10, color: muted });
  y -= 16;
  text(data.participantName, { font: bold });
  if (data.company) {
    y -= 14;
    text(data.company);
  }
  y -= 14;
  text(data.participantEmail, { color: muted });

  y -= 40;
  page.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 0.5, color: muted });
  y -= 24;
  text("Désignation", { font: bold, size: 10, color: muted });
  text("Montant", { font: bold, size: 10, color: muted, x: 440 });
  y -= 18;
  text(`CISSP Bootcamp — ${data.cohortName}`, { font: bold });
  text(formatUsdCents(data.amountUsdCents), { font: bold, x: 440 });
  y -= 14;
  text("40 h de préparation au CISSP en français, sur 15 jours, avec coach certifié.", { size: 9, color: muted });
  if (data.amountLocalLabel) {
    y -= 12;
    text(`soit ${data.amountLocalLabel}, montant indicatif`, { size: 9, color: muted, x: 440 });
  }
  y -= 20;
  page.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 0.5, color: muted });
  y -= 22;
  text("Total réglé", { font: bold, size: 13 });
  text(formatUsdCents(data.amountUsdCents), { font: bold, size: 13, x: 440 });
  y -= 16;
  text(`Payé par ${data.method === "stripe" ? "carte bancaire (Stripe)" : "mobile money (Netticket)"}`, { size: 9, color: muted });

  y -= 40;
  text("Les frais d'examen CISSP ne sont pas inclus et se règlent auprès d'ISC².", { size: 9, color: muted });
  y -= 12;
  text("Ce reçu atteste du paiement de la formation. Il ne constitue pas une facture avec TVA.", { size: 9, color: muted });

  return pdf.save();
}
