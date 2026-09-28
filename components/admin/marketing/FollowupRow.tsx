"use client";

import { Mail, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { draftFollowupFor, markFollowupSent, sendFollowupEmail } from "@/app/admin/marketing/actions";

import { CopyButton } from "./Studio";

type Lead = { id: number; firstName: string; lastName: string; heatScore: number; whatsapp: string | null; lastContactAt: string | null };

/** One prospect of a segment: draft a personal message, then send it by hand. */
export function FollowupRow({ lead, cohortId, segment }: { lead: Lead; cohortId: number; segment: string }) {
  const [channel, setChannel] = useState<"whatsapp" | "email" | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const draft = (c: "whatsapp" | "email") =>
    start(async () => {
      setChannel(c);
      setStatus(null);
      const result = await draftFollowupFor({ leadId: lead.id, cohortId, channel: c, segment });
      if (result.ok) {
        setText(result.text);
        setSubject(result.subject ?? "");
      } else setStatus(result.error);
    });

  const whatsappHref = lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}` : null;

  return (
    <li className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Link href={`/admin/leads/${lead.id}`} className="font-semibold hover:underline">{lead.firstName} {lead.lastName}</Link>
          <span className="ml-2 text-muted">chaleur {lead.heatScore}{lead.lastContactAt ? ` · relancé le ${new Date(lead.lastContactAt).toLocaleDateString("fr-FR")}` : ""}</span>
        </span>
        <span className="flex gap-2">
          {lead.whatsapp && <button type="button" disabled={pending} onClick={() => draft("whatsapp")} className={ghost}><MessageCircle className="size-4" aria-hidden />WhatsApp</button>}
          <button type="button" disabled={pending} onClick={() => draft("email")} className={ghost}><Mail className="size-4" aria-hidden />E-mail</button>
        </span>
      </div>
      {pending && <p className="mt-2 text-muted">Rédaction du message…</p>}
      {status && <p className="mt-2 rounded bg-slate-50 px-2 py-1">{status}</p>}
      {channel && text && !pending && (
        <div className="mt-3 grid gap-2">
          {channel === "email" && <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} aria-label="Objet" />}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={input} />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={text} label="Copier" />
            {channel === "whatsapp" && whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener" onClick={() => start(async () => { await markFollowupSent({ leadId: lead.id }); setStatus("Marqué comme relancé."); })} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">
                <MessageCircle className="size-4" aria-hidden />Ouvrir dans WhatsApp
              </a>
            )}
            {channel === "email" && (
              <button type="button" onClick={() => start(async () => { const r = await sendFollowupEmail({ leadId: lead.id, subject, text }); setStatus(r.ok ? "E-mail envoyé." : r.error ?? "Échec."); if (r.ok) setChannel(null); })} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">
                <Send className="size-4" aria-hidden />Envoyer cet e-mail
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
const input = "rounded-lg border border-line px-3 py-2 text-base";
