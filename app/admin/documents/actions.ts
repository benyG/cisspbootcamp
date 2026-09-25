"use server";

import { del, head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ALLOWED_MIME_TYPES, safeFilename, validateUpload } from "@/lib/documents";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  program: z.enum(["cissp", "cc"]),
  filename: z.string().trim().min(1).max(200),
  pathname: z.string().startsWith("documents/").max(255),
});

/**
 * Records a file the browser has just sent to private storage. Size and type
 * are read back from the blob itself, never taken from the browser.
 */
export async function registerDocument(input: z.input<typeof registerSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nom, formation et fichier sont requis." };

  let blob;
  try {
    blob = await head(parsed.data.pathname);
  } catch {
    return { ok: false, error: "Le fichier n'est pas arrivé dans le stockage. Réessayez." };
  }
  const error = validateUpload({ size: blob.size, mimeType: blob.contentType, filename: parsed.data.filename });
  if (error || !ALLOWED_MIME_TYPES[blob.contentType]) {
    await del(blob.pathname).catch(() => undefined);
    return { ok: false, error: error ?? "Format refusé." };
  }

  await prisma.document.create({
    data: { name: parsed.data.name, program: parsed.data.program, filename: safeFilename(parsed.data.filename), mimeType: blob.contentType, size: blob.size, blobPathname: blob.pathname },
  });
  revalidatePath("/admin/documents");
  return { ok: true };
}

export async function toggleDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const documentId = id.parse(formData.get("documentId"));
  const current = await prisma.document.findUnique({ where: { id: documentId }, select: { active: true } });
  if (current) await prisma.document.update({ where: { id: documentId }, data: { active: !current.active } });
  revalidatePath("/admin/documents");
}

/** Deletes the record and the stored file. */
export async function deleteDocument(formData: FormData): Promise<void> {
  await requireAdmin();
  const documentId = id.parse(formData.get("documentId"));
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: { blobPathname: true } });
  if (document?.blobPathname) await del(document.blobPathname).catch((error) => console.error("[documents] suppression du fichier", error));
  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath("/admin/documents");
}
