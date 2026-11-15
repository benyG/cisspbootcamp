"use client";

import { MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";

type Link = { title: string; url: string };
type Message = { role: "user" | "assistant"; text: string; links?: Link[] };
type Reply =
  | { ok: true; conversationId: string; answer: string; links: Link[]; handOver: boolean; remaining: number }
  | { ok: false; conversationId: string | null; handOver: true; reason: "off" | "budget" | "limit" | "error" }
  | { ok: false; error: string };

const UNAVAILABLE: Record<string, string> = {
  off: "L’assistant est en pause. Laissez votre question : l’équipe vous répond par e-mail.",
  budget: "L’assistant est en pause. Laissez votre question : l’équipe vous répond par e-mail.",
  limit: "Vous avez atteint la limite de messages. Laissez votre question : l’équipe vous répond par e-mail.",
  error: "Je n’ai pas pu répondre. Laissez votre question : l’équipe vous répond par e-mail.",
};

/**
 * The site assistant (lot C): answers from the FAQ and the site's pages,
 * with its sources, and hands over to the team by e-mail when it cannot.
 * Nothing loads before the visitor opens it.
 */
export function AssistantPanel({ program }: { program: "cissp" | "ia" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [handOver, setHandOver] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setDraft("");
    setLastQuestion(message);
    setMessages((m) => [...m, { role: "user", text: message }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message, program }) });
      const reply = (await res.json()) as Reply;
      if ("conversationId" in reply && reply.conversationId) setConversationId(reply.conversationId);
      if (reply.ok) {
        setMessages((m) => [...m, { role: "assistant", text: reply.answer, links: reply.links }]);
        setHandOver(reply.handOver);
        if (reply.remaining === 0) setBlocked(true);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: "reason" in reply ? UNAVAILABLE[reply.reason] ?? UNAVAILABLE.error! : reply.error }]);
        setHandOver(true);
        setBlocked(true);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: UNAVAILABLE.error! }]);
      setHandOver(true);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-[12px] border border-line bg-white px-4 py-3 font-bold text-ink hover:border-ink">
        <MessageCircleQuestion className="size-5 text-accent" aria-hidden />Votre question n’y est pas ? Posez-la
      </button>
    );
  }

  return (
    <div className="max-w-[860px] rounded-[14px] border border-line bg-white p-4 text-left text-ink">
      <p className="text-sm text-muted">Assistant automatique : il répond à partir des informations du site, avec ses sources. Pour tout le reste, l’équipe répond par e-mail.</p>
      <ul className="mt-3 grid gap-2" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "justify-self-end rounded-[12px] bg-ink px-3 py-2 text-sm text-white" : "rounded-[12px] bg-slate-50 px-3 py-2 text-sm"}>
            {m.text}
            {m.links && m.links.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {m.links.map((l) => <a key={l.url + l.title} href={l.url} className="font-semibold text-accent underline">{l.title}</a>)}
              </span>
            )}
          </li>
        ))}
        {busy && <li className="rounded-[12px] bg-slate-50 px-3 py-2 text-sm text-muted">…</li>}
      </ul>
      {!blocked && (
        <form onSubmit={ask} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="assistant-input">Votre question</label>
          <input id="assistant-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={600} placeholder="Ex. : l’examen est-il inclus ?" className="min-w-0 flex-1 rounded-[10px] border border-line px-3 py-2.5 text-base" autoFocus />
          <button disabled={busy || !draft.trim()} className="inline-flex items-center rounded-[10px] bg-ink px-3.5 text-white disabled:opacity-50" aria-label="Envoyer"><Send className="size-4" aria-hidden /></button>
        </form>
      )}
      {handOver && <HandOver conversationId={conversationId} defaultQuestion={lastQuestion} />}
    </div>
  );
}

function HandOver({ conversationId, defaultQuestion }: { conversationId: string | null; defaultQuestion: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);
    const res = await fetch("/api/assistant/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, email: form.get("email"), question: form.get("question"), consent: form.get("consent") === "on", website: form.get("website") ?? "" }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (data?.ok) setState("sent");
    else {
      setState("idle");
      setError(data?.error ?? "L’envoi a échoué. Réessayez.");
    }
  }

  if (state === "sent") return <p className="mt-3 rounded-[12px] bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Question transmise. L’équipe vous répond par e-mail.</p>;

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 border-t border-line pt-3 text-sm">
      <b>Transmettre à l’équipe</b>
      <textarea name="question" required minLength={3} maxLength={2000} rows={2} defaultValue={defaultQuestion} className="rounded-[10px] border border-line px-3 py-2 text-base" aria-label="Votre question" />
      <input name="email" type="email" required maxLength={180} placeholder="Votre e-mail" className="rounded-[10px] border border-line px-3 py-2.5 text-base" aria-label="Votre e-mail" />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-xs text-ink-2"><input type="checkbox" name="consent" required className="mt-0.5" />J’accepte que l’équipe utilise mon e-mail pour répondre à cette question, et seulement pour cela.</label>
      {error && <p className="text-xs text-red-800">{error}</p>}
      <button disabled={state === "sending"} className="justify-self-start rounded-[10px] bg-ink px-4 py-2 font-bold text-white disabled:opacity-50">Envoyer</button>
    </form>
  );
}
