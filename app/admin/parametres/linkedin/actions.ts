"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LINKEDIN_STATE_COOKIE, linkedinConfigured, linkedinConsentUrl } from "@/lib/linkedin";
import { createToken } from "@/lib/tokens";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

export async function startLinkedinConnect(): Promise<never> {
  await requireAdmin();
  if (!linkedinConfigured()) redirect("/admin/parametres/linkedin?erreur=configuration");
  const state = createToken();
  const jar = await cookies();
  jar.set(LINKEDIN_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  redirect(linkedinConsentUrl(state));
}

export async function disconnectLinkedin(): Promise<void> {
  await requireAdmin();
  await prisma.linkedinCredential.deleteMany({ where: { id: 1 } });
  revalidatePath("/admin/parametres/linkedin");
}
