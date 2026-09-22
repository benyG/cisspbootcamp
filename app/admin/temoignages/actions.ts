"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const schema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Prénom requis").max(120),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  text: z.string().trim().min(20, "Au moins deux phrases").max(1000),
  videoUrl: z.string().trim().max(255).optional().or(z.literal("")),
  published: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().default(0),
});

export async function upsertTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    role: formData.get("role"),
    country: formData.get("country"),
    text: formData.get("text"),
    videoUrl: formData.get("videoUrl"),
    published: formData.get("published") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return;

  const { id, ...data } = parsed.data;
  const clean = { ...data, role: data.role || null, country: data.country ? data.country.toUpperCase() : null, videoUrl: data.videoUrl || null };
  if (id) await prisma.testimonial.update({ where: { id }, data: clean });
  else await prisma.testimonial.create({ data: clean });

  revalidatePath("/admin/temoignages");
  revalidatePath("/");
}

export async function deleteTestimonial(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await prisma.testimonial.delete({ where: { id: id.data } });
  revalidatePath("/admin/temoignages");
  revalidatePath("/");
}
