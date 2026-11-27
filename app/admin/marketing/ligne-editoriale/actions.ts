"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { resetEditorial, saveEditorial } from "@/lib/marketing/editorial";
import { type MarketingKind, pillarsFor } from "@/lib/marketing/plan";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const kindOf = (v: FormDataEntryValue | null): MarketingKind => (v === "ia" ? "ia" : "cert");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Ben saves the editorial line of one audience (Zod-validated in saveEditorial). */
export async function saveEditorialLine(formData: FormData): Promise<void> {
  await requireAdmin();
  const kind = kindOf(formData.get("kind"));
  const pillars = Object.fromEntries(
    Object.keys(pillarsFor(kind)).map((k) => [
      k,
      {
        label: str(formData, `${k}.label`),
        intent: str(formData, `${k}.intent`),
        examples: str(formData, `${k}.examples`).split("\n").map((l) => l.trim()).filter(Boolean),
        destination: str(formData, `${k}.destination`),
        weight: str(formData, `${k}.weight`) || "0",
      },
    ]),
  );
  const result = await saveEditorial(kind, { pillars, audience: str(formData, "audience"), convictions: str(formData, "convictions"), tone: str(formData, "tone"), avoid: str(formData, "avoid"), models: str(formData, "models") });
  revalidatePath("/admin/marketing");
  redirect(`/admin/marketing/ligne-editoriale?public=${kind}&${result.ok ? "ok=1" : `erreur=${encodeURIComponent(result.error)}`}`);
}

/** Back to the defaults written on 27/11. */
export async function resetEditorialLine(formData: FormData): Promise<void> {
  await requireAdmin();
  const kind = kindOf(formData.get("kind"));
  await resetEditorial(kind);
  revalidatePath("/admin/marketing");
  redirect(`/admin/marketing/ligne-editoriale?public=${kind}&ok=1`);
}
