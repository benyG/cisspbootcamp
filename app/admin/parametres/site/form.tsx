"use client";

import { useState, useTransition } from "react";

import type { SiteSectionKey, SiteSettings } from "@/lib/site-settings";

import { saveSection } from "./actions";

/**
 * One card per section, each with its own Save. Lists (promises, steps, FAQ)
 * are edited as one line per entry — "titre | texte" — which is faster for
 * Ben than a row of inputs and easy to validate server-side.
 */
export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  return (
    <div className="mt-6 grid gap-4">
      <Section title="Héros" section="hero" initial={initial.hero} fields={[
        { name: "title", label: "Titre — la partie entre {{ }} est mise en couleur" },
        { name: "lead", label: "Accroche", rows: 3 },
        { name: "promises", label: "3 promesses — une par ligne : titre | texte", rows: 3, list: ["title", "text"] },
        { name: "microcopy", label: "Ligne sous les boutons" },
      ]} />
      <Section title="Chiffres de preuve" section="proof" initial={initial.proof} fields={[
        { name: "title", label: "Titre", rows: 2 },
        { name: "numbers", label: "4 chiffres — une par ligne : valeur | texte", rows: 4, list: ["value", "text"] },
      ]} />
      <Section title="Méthode" section="method" initial={initial.method} fields={[
        { name: "title", label: "Titre", rows: 2 },
        { name: "steps", label: "4 étapes — une par ligne : verbe | titre | texte", rows: 4, list: ["kicker", "title", "text"] },
        { name: "rhythm", label: "Rythme — 2 lignes : titre | texte", rows: 2, list: ["title", "text"] },
      ]} />
      <Section title="Vidéo" section="video" initial={initial.video} fields={[
        { name: "url", label: "URL YouTube ou Vimeo (vide = section masquée)" },
        { name: "duration", label: "Durée affichée, ex. 1 min 30" },
        { name: "title", label: "Titre", rows: 2 },
        { name: "text", label: "Texte", rows: 2 },
      ]} />
      <Section title="Le coach" section="coach" initial={initial.coach} fields={[
        { name: "name", label: "Prénom affiché" },
        { name: "tagline", label: "Sous le nom, dans le héros" },
        { name: "quote", label: "Citation" },
        { name: "bio", label: "Bio", rows: 4 },
        { name: "credentials", label: "Références — une par ligne", rows: 3, list: true },
        { name: "linkedinUrl", label: "URL LinkedIn" },
      ]} />
      <Section title="Offre et prix" section="offer" initial={initial.offer} fields={[
        { name: "title", label: "Titre", rows: 2 },
        { name: "text", label: "Texte", rows: 2 },
        { name: "included", label: "Ce qui est inclus — une ligne par élément", rows: 4, list: true },
        { name: "soonEnabled", label: "Afficher la ligne « bientôt »", checkbox: true },
        { name: "soonText", label: "Texte de la ligne « bientôt »" },
        { name: "promoLabel", label: "Étiquette du prix promotionnel" },
        { name: "referencePriceUsd", label: "Prix de référence du marché, en USD entiers (0 pour masquer la comparaison)" },
        { name: "referenceSource", label: "Source du prix de référence, affichée telle quelle" },
        { name: "referenceCheckedOn", label: "Date de vérification de ce prix (ex. septembre 2026)" },
      ]} />
      <Section title="FAQ" section="faq" initial={initial.faq} fields={[
        { name: "", label: "Une question par bloc : question | réponse", rows: 12, list: ["q", "a"], root: true },
      ]} />
      <Section title="Contact et mentions" section="contact" initial={initial.contact} fields={[
        { name: "whatsapp", label: "WhatsApp, format international (+221…) — vide pour masquer" },
        { name: "legalName", label: "Nom affiché en pied de page" },
        { name: "legalText", label: "Mentions légales (facultatif)", rows: 3 },
      ]} />
    </div>
  );
}

type Field = { name: string; label: string; rows?: number; list?: true | string[]; checkbox?: boolean; root?: boolean };

function Section<K extends SiteSectionKey>({ title, section, initial, fields }: { title: string; section: K; initial: SiteSettings[K]; fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => toForm(initial, fields));
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, start] = useTransition();

  const submit = () => {
    setState({});
    start(async () => {
      const result = await saveSection(section, fromForm(values, fields, initial));
      setState(result.ok ? { ok: true } : { error: result.error });
    });
  };

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3">
        {fields.map((f) => {
          const id = `${section}-${f.name || "root"}`;
          if (f.checkbox) {
            return (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input id={id} type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} className="size-4 accent-accent" />
                {f.label}
              </label>
            );
          }
          return (
            <label key={id} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{f.label}</span>
              {f.rows ? (
                <textarea id={id} rows={f.rows} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={input} />
              ) : (
                <input id={id} value={String(values[f.name] ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={input} />
              )}
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm">{state.ok && <span className="text-emerald-800">Enregistré, en ligne dans la minute.</span>}{state.error && <span className="text-red-700">{state.error}</span>}</span>
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60">Enregistrer</button>
      </div>
    </section>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";

function toForm(section: unknown, fields: Field[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of fields) {
    const raw = f.root ? section : (section as Record<string, unknown>)[f.name];
    if (f.checkbox) out[f.name] = Boolean(raw);
    else if (f.list === true) out[f.name] = (raw as string[]).join("\n");
    else if (Array.isArray(f.list)) out[f.name] = (raw as Record<string, string>[]).map((row) => f.list && Array.isArray(f.list) ? f.list.map((k) => row[k]).join(" | ") : "").join("\n");
    else out[f.name] = String(raw ?? "");
  }
  return out;
}

function fromForm(values: Record<string, string | boolean>, fields: Field[], initial: unknown): unknown {
  const out: Record<string, unknown> = { ...(typeof initial === "object" && !Array.isArray(initial) ? (initial as object) : {}) };
  for (const f of fields) {
    const v = values[f.name];
    let parsed: unknown;
    if (f.checkbox) parsed = Boolean(v);
    else if (f.list === true) parsed = String(v).split("\n").map((l) => l.trim()).filter(Boolean);
    else if (Array.isArray(f.list)) {
      const keys = f.list;
      parsed = String(v).split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return Object.fromEntries(keys.map((k, i) => [k, parts[i] ?? ""]));
      });
    } else parsed = String(v ?? "").trim();
    if (f.root) return parsed;
    out[f.name] = parsed;
  }
  return out;
}
