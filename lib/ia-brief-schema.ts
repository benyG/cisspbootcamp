import { z } from "zod";

import { BRIEF_FIELDS, type Brief, PAYMENTS, type PaymentChoice } from "@/lib/ia-brief";

const field = (f: (typeof BRIEF_FIELDS)[number]) => {
  const base = z.string().trim().max(f.max, `« ${f.label} » : ${f.max} caractères au plus.`);
  return f.required ? base.min(3, `Complétez « ${f.label} ».`) : base.optional().default("");
};

export const briefSchema = z.object({
  ...Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, field(f)])),
  payments: z.enum(Object.keys(PAYMENTS) as [PaymentChoice, ...PaymentChoice[]], { errorMap: () => ({ message: "Dites-nous si vous voulez encaisser en ligne." }) }),
}) as unknown as z.ZodType<Brief>;

/** The stored sheet, or null when absent or unreadable. */
export function storedBrief(value: unknown): Brief | null {
  const parsed = briefSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
