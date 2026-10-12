import { del, head, issueSignedToken, presignUrl } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { DriveAccessError, driveFile, readDriveRange } from "@/lib/drive";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { personalSessions } from "@/lib/personal-schedule";
import { storedDays } from "@/lib/personal-schedule-send";
import { buildSessions } from "@/lib/reading-plan/data";
import { planStart } from "@/lib/reading-plan/page";
import { accessEndsAt, isAccessOpen, nextRange, reopenedUntil } from "@/lib/replays";
import { TUS_CHUNK_BYTES, createUpload, deleteVideo, getVideo, playbackToken, secureVideo, sendChunk, streamEnabled, uploadOffset } from "@/lib/stream";
import { createToken } from "@/lib/tokens";

/**
 * Replays and labs, the I/O side (Ben, 12/10): uploads to Cloudflare Stream
 * (from Ben's browser or copied from his Drive), publication to chosen
 * participants, their private space, playback tokens, lab links, and
 * requests to reopen an expired access.
 */

export type Result = { ok: true; message: string } | { ok: false; error: string };

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const spaceUrl = (token: string) => `${appUrl()}/replays/${token}`;
const NOT_CONFIGURED: { ok: false; error: string } = { ok: false, error: "Cloudflare Stream n'est pas configuré : ajoutez CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_STREAM_TOKEN sur Vercel." };

/** The cohort's teaching days (from the reading plan), with their titles. */
export function cohortDays(startsAt: Date) {
  return buildSessions(planStart(startsAt)).filter((d) => !d.rest);
}

async function replayFor(cohortId: number, day: number) {
  return prisma.cohortReplay.upsert({ where: { cohortId_day: { cohortId, day } }, create: { cohortId, day }, update: {} });
}

/** Replacing a recording removes the previous one from Cloudflare. */
async function dropVideo(replay: { id: number; streamUid: string | null }) {
  if (replay.streamUid) await deleteVideo(replay.streamUid).catch((e) => console.error("[replays] suppression", e));
}

// ---- uploads

/** From Ben's computer: opens a resumable upload the browser fills itself. */
export async function startComputerUpload(cohortId: number, day: number, file: { name: string; size: number }): Promise<{ ok: true; replayId: number; uploadUrl: string } | { ok: false; error: string }> {
  if (!streamEnabled()) return NOT_CONFIGURED;
  const replay = await replayFor(cohortId, day);
  try {
    const { uploadUrl, uid } = await createUpload({ name: `Cohorte ${cohortId} · J${day} · ${file.name}`, size: file.size, appUrl: appUrl() });
    await dropVideo(replay);
    await prisma.cohortReplay.update({
      where: { id: replay.id },
      data: { streamUid: uid, videoStatus: "uploading", videoName: file.name.slice(0, 255), videoError: null, durationSec: null, source: "upload", driveFileId: null, tusUrl: uploadUrl, sourceSize: BigInt(file.size), transferOffset: BigInt(0) },
    });
    return { ok: true, replayId: replay.id, uploadUrl };
  } catch (error) {
    console.error("[replays] envoi", error);
    return { ok: false, error: error instanceof Error ? error.message : "Cloudflare n'a pas ouvert l'envoi." };
  }
}

/** The browser sent the last piece: Cloudflare now prepares the video. */
export async function finishComputerUpload(replayId: number): Promise<void> {
  await prisma.cohortReplay.updateMany({ where: { id: replayId, videoStatus: "uploading", source: "upload" }, data: { videoStatus: "processing", tusUrl: null } });
}

/** From Ben's Drive: the server copies the file to Cloudflare piece by piece (driveCopyStep). */
export async function startDriveCopy(cohortId: number, day: number, fileId: string): Promise<Result & { replayId?: number }> {
  if (!streamEnabled()) return NOT_CONFIGURED;
  try {
    const file = await driveFile(fileId);
    if (!file.mimeType.startsWith("video/") || !file.size) return { ok: false, error: "Ce fichier Drive n'est pas une vidéo." };
    const replay = await replayFor(cohortId, day);
    const { uploadUrl, uid } = await createUpload({ name: `Cohorte ${cohortId} · J${day} · ${file.name}`, size: file.size, appUrl: appUrl() });
    await dropVideo(replay);
    await prisma.cohortReplay.update({
      where: { id: replay.id },
      data: { streamUid: uid, videoStatus: "uploading", videoName: file.name.slice(0, 255), videoError: null, durationSec: null, source: "drive", driveFileId: fileId, tusUrl: uploadUrl, sourceSize: BigInt(file.size), transferOffset: BigInt(0) },
    });
    return { ok: true, message: "Copie depuis Google Drive commencée.", replayId: replay.id };
  } catch (error) {
    console.error("[replays] drive", error);
    return { ok: false, error: error instanceof Error ? error.message : "Google Drive a refusé la lecture du fichier." };
  }
}

/**
 * Copies Drive pieces to Cloudflare for up to `budgetMs`, saving progress
 * after each piece: the admin page calls it in a loop, the cron picks it
 * up if the page is closed.
 */
export async function driveCopyStep(replayId: number, budgetMs = 40_000): Promise<{ status: string; offset: number; size: number; error: string | null }> {
  const started = Date.now();
  const replay = await prisma.cohortReplay.findUnique({ where: { id: replayId } });
  if (!replay || replay.videoStatus !== "uploading" || replay.source !== "drive" || !replay.tusUrl || !replay.driveFileId || replay.sourceSize === null) {
    return { status: replay?.videoStatus ?? "none", offset: Number(replay?.transferOffset ?? 0), size: Number(replay?.sourceSize ?? 0), error: replay?.videoError ?? null };
  }
  const size = Number(replay.sourceSize);
  let offset = Number(replay.transferOffset ?? 0);
  try {
    // Another run may have moved on, or a piece may have half-landed: ask Cloudflare.
    const remote = await uploadOffset(replay.tusUrl);
    if (remote !== null) offset = remote;
    for (let range = nextRange(offset, size, TUS_CHUNK_BYTES); range && Date.now() - started < budgetMs; range = nextRange(offset, size, TUS_CHUNK_BYTES)) {
      const bytes = await readDriveRange(replay.driveFileId, range.from, range.to);
      offset = await sendChunk(replay.tusUrl, range.from, bytes);
      await prisma.cohortReplay.update({ where: { id: replayId }, data: { transferOffset: BigInt(offset), videoError: null } });
    }
    if (offset >= size) {
      await prisma.cohortReplay.update({ where: { id: replayId }, data: { videoStatus: "processing", tusUrl: null, transferOffset: BigInt(size) } });
      return { status: "processing", offset: size, size, error: null };
    }
    return { status: "uploading", offset, size, error: null };
  } catch (error) {
    console.error("[replays] copie drive", replayId, error);
    const message = (error instanceof Error ? error.message : "Copie interrompue").slice(0, 300);
    // An access problem will not fix itself; anything else is retried at the next step.
    await prisma.cohortReplay.update({ where: { id: replayId }, data: error instanceof DriveAccessError ? { videoStatus: "error", videoError: message } : { videoError: message } });
    return { status: error instanceof DriveAccessError ? "error" : "uploading", offset, size, error: message };
  }
}

/**
 * Cron, every 15 minutes: Drive copies left running, videos Cloudflare is
 * preparing, browser uploads abandoned for a day.
 */
export async function syncReplays(now = new Date()): Promise<number> {
  if (!streamEnabled()) return 0;
  const rows = await prisma.cohortReplay.findMany({ where: { videoStatus: { in: ["uploading", "processing"] } }, select: { id: true, videoStatus: true, source: true, streamUid: true, updatedAt: true } });
  let changed = 0;
  const started = Date.now();
  for (const r of rows) {
    if (r.videoStatus === "uploading" && r.source === "drive") {
      if (Date.now() - started < 45_000) await driveCopyStep(r.id, 45_000 - (Date.now() - started));
      continue;
    }
    if (r.videoStatus === "uploading" && now.getTime() - r.updatedAt.getTime() > 24 * 3_600_000) {
      await prisma.cohortReplay.update({ where: { id: r.id }, data: { videoStatus: "error", videoError: "Envoi interrompu : renvoyez la vidéo." } });
      changed++;
      continue;
    }
    if (r.videoStatus === "processing" && r.streamUid && (await refreshVideo(r.id, r.streamUid))) changed++;
  }
  return changed;
}

/** Asks Cloudflare whether a video is ready; locks it down once it is. */
export async function refreshVideo(replayId: number, uid: string): Promise<boolean> {
  try {
    const state = await getVideo(uid);
    if (state.ready) {
      await secureVideo(uid, appUrl());
      await prisma.cohortReplay.update({ where: { id: replayId }, data: { videoStatus: "ready", durationSec: state.duration, videoError: null } });
      return true;
    }
    if (state.error) {
      await prisma.cohortReplay.update({ where: { id: replayId }, data: { videoStatus: "error", videoError: state.error.slice(0, 300) } });
      return true;
    }
  } catch (error) {
    console.error("[replays] état", replayId, error);
  }
  return false;
}

export async function removeVideo(cohortId: number, day: number): Promise<void> {
  const replay = await prisma.cohortReplay.findUnique({ where: { cohortId_day: { cohortId, day } } });
  if (!replay) return;
  await dropVideo(replay);
  await prisma.cohortReplay.update({ where: { id: replay.id }, data: { streamUid: null, videoStatus: "none", videoName: null, videoError: null, durationSec: null, source: null, driveFileId: null, tusUrl: null, sourceSize: null, transferOffset: null } });
}

// ---- labs

export async function attachLab(cohortId: number, day: number, input: { pathname: string; name: string }): Promise<Result> {
  if (!input.pathname.startsWith(`replays/labs/${cohortId}/`)) return { ok: false, error: "Fichier refusé." };
  const blob = await head(input.pathname).catch(() => null);
  if (!blob) return { ok: false, error: "Le fichier n'est pas arrivé : renvoyez-le." };
  const replay = await replayFor(cohortId, day);
  if (replay.labPathname && replay.labPathname !== input.pathname) await del(replay.labPathname).catch(() => undefined);
  await prisma.cohortReplay.update({ where: { id: replay.id }, data: { labPathname: input.pathname, labName: input.name.slice(0, 255), labSize: blob.size } });
  return { ok: true, message: `Lab ajouté à J${day}.` };
}

export async function removeLab(cohortId: number, day: number): Promise<void> {
  const replay = await prisma.cohortReplay.findUnique({ where: { cohortId_day: { cohortId, day } } });
  if (!replay?.labPathname) return;
  await del(replay.labPathname).catch(() => undefined);
  await prisma.cohortReplay.update({ where: { id: replay.id }, data: { labPathname: null, labName: null, labSize: null } });
}

// ---- participants

/** Paid participants of the cohort, with their personal calendar's last day if they have one. */
export async function cohortParticipants(cohortId: number) {
  const [registrations, personal] = await Promise.all([
    prisma.registration.findMany({ where: { cohortId, status: "paid" }, include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.personalSchedule.findMany({ where: { cohortId, status: "confirmed" }, select: { leadId: true, days: true } }),
  ]);
  const lastDay = new Map(personal.map((p) => [p.leadId, personalSessions(storedDays(p.days)).at(-1)?.date ?? null]));
  const seen = new Set<number>();
  return registrations.map((r) => ({ ...r.lead, personalLastDate: lastDay.get(r.lead.id) ?? null })).filter((l) => !seen.has(l.id) && seen.add(l.id));
}

/** The participant's space for the cohort; created on first publication, its end recomputed (never shortened). */
async function ensureAccess(cohort: { id: number; endsAt: Date }, lead: { id: number; personalLastDate: string | null }) {
  const end = accessEndsAt({ cohortEndsAt: cohort.endsAt, personalLastDate: lead.personalLastDate });
  const existing = await prisma.replayAccess.findUnique({ where: { cohortId_leadId: { cohortId: cohort.id, leadId: lead.id } } });
  if (existing) {
    return existing.expiresAt < end ? prisma.replayAccess.update({ where: { id: existing.id }, data: { expiresAt: end } }) : existing;
  }
  return prisma.replayAccess.create({ data: { cohortId: cohort.id, leadId: lead.id, token: createToken(), expiresAt: end } });
}

/**
 * Publishes a day's replay to the chosen participants (all paid ones when
 * `leadIds` is "all"); each new one gets an e-mail with the link to their
 * space. Publishing again adds people; nobody is e-mailed twice.
 */
export async function publishReplay(cohortId: number, day: number, leadIds: number[] | "all"): Promise<Result> {
  const [cohort, replay, people] = await Promise.all([
    prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true, name: true, startsAt: true, endsAt: true } }),
    prisma.cohortReplay.findUnique({ where: { cohortId_day: { cohortId, day } }, include: { grants: { select: { leadId: true } } } }),
    cohortParticipants(cohortId),
  ]);
  if (!cohort || !replay) return { ok: false, error: "Rien à publier pour ce jour." };
  if (replay.videoStatus !== "ready" && !replay.labPathname) return { ok: false, error: "Ajoutez d'abord la vidéo (prête) ou le lab." };
  if (replay.videoStatus !== "ready" && replay.videoStatus !== "none") return { ok: false, error: "La vidéo n'est pas encore prête : attendez la fin du traitement." };
  const chosen = leadIds === "all" ? people : people.filter((p) => leadIds.includes(p.id));
  if (chosen.length === 0) return { ok: false, error: "Choisissez au moins une personne inscrite." };
  const already = new Set(replay.grants.map((g) => g.leadId));
  const fresh = chosen.filter((p) => !already.has(p.id));
  if (fresh.length === 0) return { ok: false, error: "Ces personnes y ont déjà accès." };

  const session = cohortDays(cohort.startsAt).find((d) => d.n === day);
  let emailed = 0;
  for (const person of fresh) {
    const access = await ensureAccess(cohort, person);
    await prisma.replayGrant.create({ data: { replayId: replay.id, leadId: person.id } });
    const what = [replay.videoStatus === "ready" ? "le replay" : null, replay.labPathname ? "le lab" : null].filter(Boolean).join(" et ");
    const result = await sendEmail({
      to: person.email,
      subject: `J${day} disponible : ${what} · CISSP Bootcamp`,
      text: [
        `Bonjour ${person.firstName},`,
        "",
        `${what.charAt(0).toUpperCase() + what.slice(1)} de la session J${day}${session ? ` (${session.title})` : ""} ${what.includes(" et ") ? "sont disponibles" : "est disponible"} dans votre espace :`,
        spaceUrl(access.token),
        "",
        replay.videoStatus === "ready" ? "La vidéo se regarde en ligne, sur cette page uniquement ; elle vous est personnelle." : "",
        `Votre accès est ouvert jusqu’au ${access.expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`,
        "",
        "Bonne révision,",
        "Ben",
      ].filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n"),
    });
    if (result.sent) emailed++;
    await prisma.actionLog.create({ data: { leadId: person.id, type: "replay_published", channel: "email", payload: { cohortId, day } } });
  }
  await prisma.cohortReplay.update({ where: { id: replay.id }, data: { publishedAt: replay.publishedAt ?? new Date() } });
  return { ok: true, message: `J${day} publié pour ${fresh.length} personne(s) ; ${emailed} e-mail(s) envoyé(s).` };
}

// ---- the participant's space

export async function accessByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.replayAccess.findUnique({ where: { token }, include: { lead: { select: { id: true, firstName: true, lastName: true, email: true } }, cohort: { select: { id: true, name: true, startsAt: true } } } });
}

/** The days published to this person, in plan order. */
export async function grantedReplays(access: { cohortId: number; leadId: number }) {
  return prisma.cohortReplay.findMany({
    where: { cohortId: access.cohortId, grants: { some: { leadId: access.leadId } } },
    orderBy: { day: "asc" },
    select: { id: true, day: true, videoStatus: true, streamUid: true, durationSec: true, labPathname: true, labName: true, labSize: true },
  });
}

/** A playback token for one day, if this person may watch it now; each viewing is logged. */
export async function playbackFor(access: { id: number; cohortId: number; leadId: number; expiresAt: Date }, day: number, now = new Date(), options: { log?: boolean } = {}): Promise<string | null> {
  if (!isAccessOpen(access.expiresAt, now) || !streamEnabled()) return null;
  const replay = await prisma.cohortReplay.findFirst({ where: { cohortId: access.cohortId, day, videoStatus: "ready", grants: { some: { leadId: access.leadId } } }, select: { streamUid: true } });
  if (!replay?.streamUid) return null;
  const token = await playbackToken(replay.streamUid, now.getTime());
  // Ben checking a participant's space is not a viewing.
  if (options.log !== false) {
    await prisma.replayAccess.update({ where: { id: access.id }, data: { lastViewedAt: now } });
    await prisma.actionLog.create({ data: { leadId: access.leadId, type: "replay_viewed", payload: { cohortId: access.cohortId, day } } });
  }
  return token;
}

/** A ten-minute link to the lab ZIP, if this person may have it now. */
export async function labLinkFor(token: string, day: number, now = new Date()): Promise<string | null> {
  const access = await accessByToken(token);
  if (!access || !isAccessOpen(access.expiresAt, now)) return null;
  const replay = await prisma.cohortReplay.findFirst({ where: { cohortId: access.cohortId, day, grants: { some: { leadId: access.leadId } } }, select: { labPathname: true } });
  if (!replay?.labPathname) return null;
  const validUntil = now.getTime() + 10 * 60_000;
  const signed = await issueSignedToken({ pathname: replay.labPathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname: replay.labPathname, access: "private", validUntil });
  await prisma.actionLog.create({ data: { leadId: access.leadId, type: "lab_downloaded", payload: { cohortId: access.cohortId, day } } });
  return presignedUrl;
}

// ---- reopening an expired access

export async function requestReopen(token: string, note: string, now = new Date()): Promise<Result> {
  const access = await accessByToken(token);
  if (!access) return { ok: false, error: "Lien invalide." };
  if (isAccessOpen(access.expiresAt, now)) return { ok: false, error: "Votre accès est encore ouvert." };
  if (access.requestedAt) return { ok: false, error: "Votre demande est déjà envoyée : Ben vous répond par e-mail." };
  await prisma.replayAccess.update({ where: { id: access.id }, data: { requestedAt: now, requestNote: note } });
  await sendEmail({
    to: env.ADMIN_EMAIL,
    subject: `Demande d'accès aux replays : ${access.lead.firstName} ${access.lead.lastName}`,
    text: [`${access.lead.firstName} ${access.lead.lastName} (${access.cohort.name}) demande à revoir les replays :`, "", note, "", `Rouvrir ou refuser : ${appUrl()}/admin/cohortes/${access.cohortId}/replays`].join("\n"),
  });
  return { ok: true, message: "Demande envoyée." };
}

export async function reopenAccess(accessId: number, months: number, now = new Date()): Promise<Result> {
  const access = await prisma.replayAccess.findUnique({ where: { id: accessId }, include: { lead: true } });
  if (!access) return { ok: false, error: "Accès introuvable." };
  const until = reopenedUntil(access.expiresAt, months, now);
  await prisma.replayAccess.update({ where: { id: accessId }, data: { expiresAt: until, requestedAt: null, requestNote: null } });
  await sendEmail({
    to: access.lead.email,
    subject: "Vos replays sont de nouveau ouverts · CISSP Bootcamp",
    text: [`Bonjour ${access.lead.firstName},`, "", `Votre accès aux replays est rouvert jusqu’au ${until.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}, avec le même lien :`, spaceUrl(access.token), "", "Bonne révision,", "Ben"].join("\n"),
  });
  return { ok: true, message: `Accès de ${access.lead.firstName} rouvert jusqu'au ${until.toLocaleDateString("fr-FR")}.` };
}

export async function refuseReopen(accessId: number): Promise<Result> {
  const access = await prisma.replayAccess.findUnique({ where: { id: accessId }, include: { lead: true } });
  if (!access) return { ok: false, error: "Accès introuvable." };
  await prisma.replayAccess.update({ where: { id: accessId }, data: { requestedAt: null, requestNote: null } });
  await sendEmail({
    to: access.lead.email,
    subject: "Votre demande d'accès aux replays · CISSP Bootcamp",
    text: [`Bonjour ${access.lead.firstName},`, "", "Je ne peux pas rouvrir l’accès aux replays pour le moment. Répondez à cet e-mail si vous voulez en parler.", "", "Ben"].join("\n"),
  });
  return { ok: true, message: `Demande refusée : ${access.lead.firstName} a reçu un e-mail.` };
}
