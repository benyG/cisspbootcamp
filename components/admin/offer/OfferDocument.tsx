import { type Offer, FORMATS, PROGRAM_TITLES, ccProgramme, cisspProgramme, inclusions, longDate, offerLines, usd, validUntil } from "@/lib/offer";
import { PROGRAMS } from "@/lib/programs";
import type { SiteSettings } from "@/lib/site-settings";

export type OfferContext = Pick<SiteSettings, "company" | "coach"> & { steps: SiteSettings["method"]["steps"]; included: string[] };

const h2 = "mt-7 mb-2 border-b-2 border-[#0f8e73] pb-1 text-[15px] font-black tracking-[-.01em] text-[#071a33] break-after-avoid";
const p = "text-[11.5px] leading-[1.55] text-[#14324f]";

/**
 * The service offer as an A4 document (Ben, 21/10): ExamBoot's letterhead,
 * the need, who we are, the programme, the terms, the price, signatures.
 * Printed to PDF from the browser; no client code here.
 */
export function OfferDocument({ offer: o, ctx }: { offer: Offer; ctx: OfferContext }) {
  const c = ctx.company;
  const { lines, totalUsd } = offerLines(o);
  const { yes, no } = inclusions(o, ctx.included);
  const legal = [c.name, c.legalForm, c.registration && `Immatriculation : ${c.registration}`, c.taxId && `Identifiant fiscal : ${c.taxId}`].filter(Boolean).join(" · ");
  const contact = [c.address, c.phone, c.email, c.website.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ");
  const onsite = o.format !== "online";
  return (
    <article id="offer-doc" className="mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] font-sans text-[#071a33] shadow-[0_10px_30px_rgba(7,26,51,.08)] print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b border-[#dfe5e8] pb-4">
        <div>
          <div className="text-[26px] leading-none font-black tracking-[-.04em]">{c.name}</div>
          <div className="mt-1 text-[10px] text-[#607085]">{contact}</div>
        </div>
        <div className="text-right text-[10.5px] leading-[1.5] text-[#14324f]">
          <div><b>Référence</b> {o.reference}</div>
          <div><b>Date</b> {longDate(new Date(`${o.issuedOn}T12:00:00Z`))}</div>
          <div><b>Valable jusqu’au</b> {longDate(validUntil(o))}</div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-[1fr_auto] items-end gap-6">
        <div>
          <div className="text-[10px] font-extrabold tracking-[.12em] text-[#0f8e73] uppercase">Offre de service</div>
          <h1 className="mt-1 text-[26px] leading-[1.05] font-black tracking-[-.03em]">{PROGRAM_TITLES[o.program]} pour {o.organization || "votre organisation"}</h1>
          <p className={p + " mt-2"}>{FORMATS[o.format]} · {o.participants} participant{o.participants > 1 ? "s" : ""} · en français · par CISSP Bootcamp</p>
        </div>
        <div className="rounded-lg border border-[#dfe5e8] px-4 py-3 text-[11px] leading-[1.5]">
          <div className="text-[9.5px] font-extrabold tracking-[.1em] text-[#607085] uppercase">À l’attention de</div>
          <b>{o.contactName || "—"}</b>{o.jobTitle && <div>{o.jobTitle}</div>}
          <div>{o.organization}{o.country ? `, ${o.country}` : ""}</div>
          {o.email && <div className="text-[#607085]">{o.email}</div>}
        </div>
      </section>

      {o.objectives && (<><h2 className={h2}>1. Votre besoin</h2><p className={p + " whitespace-pre-line"}>{o.objectives}</p></>)}

      <h2 className={h2}>{o.objectives ? 2 : 1}. Qui sommes-nous</h2>
      <p className={p}>{c.presentation}</p>
      <p className={p + " mt-1.5"}>La formation est animée par <b>{ctx.coach.name}</b> ({ctx.coach.credentials.join(", ")}). {ctx.coach.bio}</p>

      <h2 className={h2}>{o.objectives ? 3 : 2}. La formation proposée</h2>
      {o.program !== "cc" && (
        <div className="break-inside-avoid">
          <p className={p}><b>{PROGRAMS.cissp.name}</b> : {PROGRAMS.cissp.hours} h de sessions live pour préparer l’examen CISSP d’ISC², les 8 domaines du référentiel (CBK), avec un plan de préparation jusqu’à l’examen.</p>
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <thead><tr className="bg-[#f2f5f4] text-left text-[9.5px] tracking-[.06em] text-[#607085] uppercase"><th className="px-2 py-1.5">Domaine</th><th className="px-2 py-1.5">Modules</th><th className="px-2 py-1.5 text-right">Poids à l’examen</th><th className="px-2 py-1.5 text-right">Heures</th></tr></thead>
            <tbody>
              {cisspProgramme().map((d) => (
                <tr key={d.domain} className="border-b border-[#eef1f3] align-top">
                  <td className="px-2 py-1.5 font-bold">{d.domain}. {d.name}</td>
                  <td className="px-2 py-1.5 text-[#14324f]">{d.modules.join(" · ")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.weight} %</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.hours % 1 ? `${Math.floor(d.hours)} h 30` : `${d.hours} h`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-[#607085]">Les heures restantes sont consacrées à la synthèse et à l’entraînement en conditions d’examen.</p>
        </div>
      )}
      {o.program !== "cissp" && (
        <div className="mt-3 break-inside-avoid">
          <p className={p}><b>Formation CC d’ISC²</b> : {PROGRAMS.cc.hours} h de sessions live pour préparer la certification Certified in Cybersecurity, première certification pour les profils qui débutent.</p>
          <ul className="mt-1.5 grid gap-0.5">
            {ccProgramme().map((d) => <li key={d.title} className={p}><b>{d.title}</b> ({d.weight}) : {d.text}</li>)}
          </ul>
        </div>
      )}

      <div className="break-inside-avoid">
        <h2 className={h2}>{o.objectives ? 4 : 3}. La méthode</h2>
        <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {ctx.steps.map((s, i) => <li key={s.title} className={p}><b>{i + 1}. {s.title}.</b> {s.text}</li>)}
        </ol>
      </div>

      <div className="break-inside-avoid">
        <h2 className={h2}>{o.objectives ? 5 : 4}. Modalités</h2>
        <dl className="grid grid-cols-[34mm_1fr] gap-x-4 gap-y-1 text-[11.5px] leading-[1.5]">
          <dt className="text-[#607085]">Format</dt><dd>{FORMATS[o.format]}{o.location ? `, ${o.location}` : ""}</dd>
          <dt className="text-[#607085]">Participants</dt><dd>{o.participants} collaborateur{o.participants > 1 ? "s" : ""} de {o.organization || "votre organisation"}, en session réservée</dd>
          <dt className="text-[#607085]">Langue</dt><dd>Français ; le vocabulaire anglais de l’examen est travaillé au fil des sessions</dd>
          <dt className="text-[#607085]">Calendrier</dt><dd className="whitespace-pre-line">{o.schedule}</dd>
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-6">
          <div><div className="text-[10px] font-extrabold tracking-[.1em] text-[#0f8e73] uppercase">Inclus</div><ul className="mt-1 grid gap-0.5">{yes.map((l) => <li key={l} className={p}>✓ {l}</li>)}</ul></div>
          <div><div className="text-[10px] font-extrabold tracking-[.1em] text-[#9b2c1f] uppercase">Non inclus</div><ul className="mt-1 grid gap-0.5">{no.map((l) => <li key={l} className={p}>– {l}</li>)}</ul></div>
        </div>
      </div>

      <div className="break-inside-avoid">
        <h2 className={h2}>{o.objectives ? 6 : 5}. Proposition financière</h2>
        <table className="w-full border-collapse text-[11px]">
          <thead><tr className="bg-[#f2f5f4] text-left text-[9.5px] tracking-[.06em] text-[#607085] uppercase"><th className="px-2 py-1.5">Désignation</th><th className="px-2 py-1.5 text-right">Participants</th><th className="px-2 py-1.5 text-right">Prix unitaire</th><th className="px-2 py-1.5 text-right">Total</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b border-[#eef1f3]"><td className="px-2 py-1.5">{l.label}</td><td className="px-2 py-1.5 text-right tabular-nums">{l.participants}</td><td className="px-2 py-1.5 text-right tabular-nums">{l.unitUsd ? usd(l.unitUsd) : "à préciser"}</td><td className="px-2 py-1.5 text-right tabular-nums">{l.unitUsd ? usd(l.totalUsd) : "—"}</td></tr>
            ))}
            <tr><td colSpan={3} className="px-2 py-2 text-right font-black">Total</td><td className="px-2 py-2 text-right text-[13px] font-black tabular-nums">{totalUsd ? usd(totalUsd) : "—"}</td></tr>
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-[#607085]">Montants en dollars américains (USD).{onsite && c.onsiteTerms ? ` ${c.onsiteTerms}` : ""}</p>
      </div>

      <div className="break-inside-avoid">
        <h2 className={h2}>{o.objectives ? 7 : 6}. Conditions</h2>
        <ul className="grid gap-0.5">
          <li className={p}><b>Paiement :</b> {o.paymentTerms}</li>
          <li className={p}><b>Validité :</b> cette offre est valable jusqu’au {longDate(validUntil(o))}.</li>
          {o.extraTerms && <li className={p + " whitespace-pre-line"}>{o.extraTerms}</li>}
        </ul>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-8 break-inside-avoid text-[11px]">
        <div className="rounded-lg border border-[#dfe5e8] p-3">
          <div className="text-[9.5px] font-extrabold tracking-[.1em] text-[#607085] uppercase">Pour {c.name}</div>
          <b className="mt-1 block">{c.signatory}</b>{c.signatoryTitle && <div>{c.signatoryTitle}</div>}
          <div className="mt-10 border-t border-dashed border-[#dfe5e8] pt-1 text-[9.5px] text-[#607085]">Signature</div>
        </div>
        <div className="rounded-lg border border-[#dfe5e8] p-3">
          <div className="text-[9.5px] font-extrabold tracking-[.1em] text-[#607085] uppercase">Bon pour accord · {o.organization || "le client"}</div>
          <div className="mt-1">Nom, fonction et date :</div>
          <div className="mt-10 border-t border-dashed border-[#dfe5e8] pt-1 text-[9.5px] text-[#607085]">Signature et cachet</div>
        </div>
      </section>

      <footer className="mt-6 border-t border-[#dfe5e8] pt-2 text-center text-[9px] leading-[1.5] text-[#607085]">{legal}{contact ? <><br />{contact}</> : null}</footer>
    </article>
  );
}
