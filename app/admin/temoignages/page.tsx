import Link from "next/link";

import { prisma } from "@/lib/db";

import { deleteTestimonial, upsertTestimonial } from "./actions";

export const dynamic = "force-dynamic";

/** Testimonials (SPECS A9): edited on the fly, live on the landing at once. */
export default async function TestimonialsPage() {
  const items = await prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 text-2xl font-bold">Témoignages</h1>
      <p className="mt-1 text-sm text-muted">Prénom, rôle, pays : dans une communauté où tout le monde se connaît, un témoignage anonyme ne vaut rien. La section est masquée tant qu&apos;aucun n&apos;est publié.</p>

      <ul className="mt-6 grid gap-3">
        {items.map((t) => (
          <li key={t.id} className="rounded-xl border border-line bg-white p-4">
            <form action={upsertTestimonial} className="grid gap-2">
              <input type="hidden" name="id" value={t.id} />
              <Fields t={t} />
              <div className="flex items-center justify-between">
                <button formAction={deleteTestimonial} className="text-sm text-red-700 underline">Supprimer</button>
                <button type="submit" className={btn}>Enregistrer</button>
              </div>
            </form>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Nouveau témoignage</h2>
        <form action={upsertTestimonial} className="mt-3 grid gap-2">
          <Fields />
          <div className="flex justify-end"><button type="submit" className={btn}>Ajouter</button></div>
        </form>
      </section>
    </main>
  );
}

function Fields({ t }: { t?: { name: string; role: string | null; country: string | null; text: string; videoUrl: string | null; published: boolean; sortOrder: number } }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
        <input name="name" required placeholder="Prénom N." defaultValue={t?.name} className={input} />
        <input name="role" placeholder="Rôle, ex. Analyste SOC" defaultValue={t?.role ?? ""} className={input} />
        <input name="country" placeholder="SN" maxLength={2} defaultValue={t?.country ?? ""} className={input} />
      </div>
      <textarea name="text" required rows={3} placeholder="Deux ou trois phrases, dans ses mots." defaultValue={t?.text} className={input} />
      <div className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
        <input name="videoUrl" placeholder="URL vidéo (facultatif)" defaultValue={t?.videoUrl ?? ""} className={input} />
        <input name="sortOrder" type="number" title="Ordre" defaultValue={t?.sortOrder ?? 0} className={input} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={t?.published ?? true} className="size-4 accent-accent" />Publié</label>
      </div>
    </>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
const btn = "rounded-lg bg-accent px-4 py-2 font-semibold text-white";
