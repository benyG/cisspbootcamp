"use server";

import { type IaSubmitResult, submitIaDiagnostic } from "@/lib/ia-diagnostic-server";
import { recordServerEvent } from "@/lib/tracking/server";

export async function submitIaDiagnosticAction(input: unknown): Promise<IaSubmitResult> {
  let result: IaSubmitResult;
  try {
    result = await submitIaDiagnostic(input);
  } catch (error) {
    console.error("[ia-diagnostic] échec de l'enregistrement", error);
    return { ok: false, error: "Le résultat n’a pas pu être enregistré. Réessayez dans un instant." };
  }
  if (result.ok) await recordServerEvent({ name: "ia_diagnostic_submit" }).catch(() => undefined);
  return result;
}
