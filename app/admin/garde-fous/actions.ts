"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { AUTOMATION_KEYS, type AutomationKey } from "@/lib/guardrails";
import { loadGuardrails, saveGuardrails } from "@/lib/guardrails-server";

async function admin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

function refresh(): void {
  revalidatePath("/admin/garde-fous");
  revalidatePath("/admin");
  revalidatePath("/admin/playbooks");
}

/** The general stop: everything that writes to people pauses at once. */
export async function setStopped(formData: FormData): Promise<void> {
  await admin();
  const parsed = z.object({ stopped: z.enum(["1", "0"]) }).safeParse({ stopped: formData.get("stopped") });
  if (!parsed.success) return;
  const g = await loadGuardrails();
  const stopped = parsed.data.stopped === "1";
  await saveGuardrails({ ...g, stopped, stoppedAt: stopped ? new Date().toISOString() : null });
  refresh();
}

/** One automation on or off. */
export async function setAutomation(formData: FormData): Promise<void> {
  await admin();
  const parsed = z.object({ key: z.enum(AUTOMATION_KEYS as [AutomationKey, ...AutomationKey[]]), on: z.enum(["1", "0"]) }).safeParse({ key: formData.get("key"), on: formData.get("on") });
  if (!parsed.success) return;
  const g = await loadGuardrails();
  const off = g.off.filter((k) => k !== parsed.data.key);
  await saveGuardrails({ ...g, off: parsed.data.on === "1" ? off : [...off, parsed.data.key] });
  refresh();
}

/** The two numbers: AI budget in USD and automatic messages per person per week. */
export async function setLimits(formData: FormData): Promise<void> {
  await admin();
  const parsed = z
    .object({ aiBudgetUsd: z.coerce.number().min(0).max(10_000), pressurePerWeek: z.coerce.number().int().min(1).max(7) })
    .safeParse({ aiBudgetUsd: formData.get("aiBudgetUsd"), pressurePerWeek: formData.get("pressurePerWeek") });
  if (!parsed.success) return;
  const g = await loadGuardrails();
  await saveGuardrails({ ...g, ...parsed.data });
  refresh();
}
