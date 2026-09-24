"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { safeFilename, validateUpload } from "@/lib/documents";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

/** Stores one file from the upload form; errors come back through the query string. */
export async function uploadDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ name: z.string().trim().min(2).max(120), program: z.enum(["cissp", "cc"]) }).safeParse({ name: formData.get("name"), program: formData.get("program") });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File)) redirect("/admin/documents?erreur=" + encodeURIComponent("Nom, programme et fichier sont requis."));

  const error = validateUpload({ size: file.size, mimeType: file.type, filename: file.name });
  if (error) redirect("/admin/documents?erreur=" + encodeURIComponent(error));

  const content = Buffer.from(await file.arrayBuffer());
  await prisma.document.create({
    data: { name: parsed.data.name, program: parsed.data.program, filename: safeFilename(file.name), mimeType: file.type, size: content.byteLength, content },
  });
  revalidatePath("/admin/documents");
  redirect("/admin/documents?ok=1");
}

export async function toggleDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const documentId = id.parse(formData.get("documentId"));
  const current = await prisma.document.findUnique({ where: { id: documentId }, select: { active: true } });
  if (current) await prisma.document.update({ where: { id: documentId }, data: { active: !current.active } });
  revalidatePath("/admin/documents");
}

export async function deleteDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const documentId = id.parse(formData.get("documentId"));
  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath("/admin/documents");
}
