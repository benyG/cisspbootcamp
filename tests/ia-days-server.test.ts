import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = { cohort: { create: vi.fn(), update: vi.fn(), delete: vi.fn() }, iaDay: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } };
  return { tx, iaDay: { findMany: vi.fn(), findUnique: vi.fn() }, cohort: { findMany: vi.fn() }, $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/replays-server", () => ({ cohortDays: () => [] }));
const reg = vi.hoisted(() => ({ loadOpenCohorts: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/registration", () => reg);

import { deleteIaDay, iaCohortName, openIaDates, openIaEntries, updateIaDay } from "@/lib/ia-days-server";

const now = new Date("2027-01-10T12:00:00Z");

describe("Bâtisseur IA, dates (Ben, 03/11)", () => {
  beforeEach(() => {
    for (const group of [db.tx.cohort, db.tx.iaDay, db.iaDay]) for (const f of Object.values(group)) f.mockReset();
    let id = 100;
    db.tx.cohort.create.mockImplementation(async () => ({ id: ++id }));
  });

  it("opens the weekend days in rotation and a cohort for each J1", async () => {
    db.iaDay.findMany.mockResolvedValue([]);
    const r = await openIaDates({ from: "2027-01-20", to: "2027-02-13", which: "both", start: "10:00", capacity: 12 }, now);
    expect(r).toEqual({ ok: true, message: "7 dates ouvertes, dont 2 entrées (J1)." });
    const created = db.tx.iaDay.create.mock.calls.map((c) => c[0].data);
    expect(created.map((d) => [d.date, d.journee])).toEqual([["2027-01-23", 1], ["2027-01-24", 2], ["2027-01-30", 3], ["2027-01-31", 4], ["2027-02-06", 5], ["2027-02-07", 6], ["2027-02-13", 1]]);
    expect(created[0].cohortId).toBe(101);
    expect(created[1].cohortId).toBeNull();
    const cohort = db.tx.cohort.create.mock.calls[0][0].data;
    expect(cohort).toMatchObject({ program: "ia", name: "Entrée du samedi 23 janvier 2027", capacity: 12, status: "open" });
    expect(cohort.startsAt.toISOString()).toBe("2027-01-23T15:00:00.000Z");
    expect(cohort.endsAt > cohort.startsAt).toBe(true);
  });

  it("keeps Saturdays only and skips dates already open", async () => {
    db.iaDay.findMany.mockResolvedValue([{ date: "2027-01-23", journee: 1, closed: false }]);
    const r = await openIaDates({ from: "2027-01-17", to: "2027-01-31", which: "saturday", start: "10:00", capacity: 12 }, now);
    expect(r).toEqual({ ok: true, message: "1 date ouverte." });
    expect(db.tx.iaDay.create.mock.calls[0][0].data).toMatchObject({ date: "2027-01-30", journee: 2, cohortId: null });
    expect(db.tx.cohort.create).not.toHaveBeenCalled();
  });

  it("says so when nothing is left to open", async () => {
    db.iaDay.findMany.mockResolvedValue([{ date: "2027-01-23", journee: 1, closed: false }]);
    expect(await openIaDates({ from: "2027-01-23", to: "2027-01-23", which: "both", start: "10:00", capacity: 12 }, now)).toEqual({ ok: false, error: "Ces dates sont déjà ouvertes." });
    expect(await openIaDates({ from: "2027-01-25", to: "2027-01-28", which: "both", start: "10:00", capacity: 12 }, now)).toMatchObject({ ok: false });
    // Past weekends (2 and 9 January) are never opened.
    expect(await openIaDates({ from: "2027-01-01", to: "2027-01-09", which: "both", start: "10:00", capacity: 12 }, now)).toEqual({ ok: false, error: "Aucun samedi ni dimanche à venir dans cette période." });
  });

  it("never moves the journée of a date with seats taken", async () => {
    db.iaDay.findUnique.mockResolvedValue({ id: 1, date: "2027-01-24", journee: 2, cohortId: null, _count: { seats: 3 }, cohort: null });
    expect(await updateIaDay({ id: 1, journee: 3, start: "10:00", capacity: 12, closed: false }, now)).toMatchObject({ ok: false });
    expect(await updateIaDay({ id: 1, journee: 2, start: "10:00", capacity: 2, closed: false }, now)).toEqual({ ok: false, error: "3 places sont déjà prises sur cette date." });
    expect(await updateIaDay({ id: 1, journee: 2, start: "11:00", capacity: 10, closed: true }, now)).toMatchObject({ ok: true });
    expect(db.tx.iaDay.update.mock.calls[0][0].data).toEqual({ journee: 2, start: "11:00", capacity: 10, closed: true, cohortId: null });
  });

  it("turning an empty J1 into J2 removes its cohort; J2 into J1 creates one", async () => {
    db.iaDay.findUnique.mockResolvedValueOnce({ id: 1, date: "2027-01-23", journee: 1, cohortId: 7, _count: { seats: 0 }, cohort: { id: 7, _count: { registrations: 0, seatHolds: 0 } } });
    expect(await updateIaDay({ id: 1, journee: 2, start: "10:00", capacity: 12, closed: false }, now)).toMatchObject({ ok: true });
    expect(db.tx.cohort.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    db.iaDay.findUnique.mockResolvedValueOnce({ id: 2, date: "2027-01-24", journee: 2, cohortId: null, _count: { seats: 0 }, cohort: null });
    expect(await updateIaDay({ id: 2, journee: 1, start: "10:00", capacity: 12, closed: false }, now)).toMatchObject({ ok: true });
    expect(db.tx.cohort.create.mock.calls[0][0].data.name).toBe(iaCohortName("2027-01-24"));
    expect(db.tx.iaDay.update.mock.calls.at(-1)![0].data.cohortId).toBe(101);
  });

  it("deletes only an empty date, with its empty cohort", async () => {
    db.iaDay.findUnique.mockResolvedValueOnce({ id: 1, date: "2027-01-23", journee: 1, cohortId: 7, _count: { seats: 0 }, cohort: { id: 7, _count: { registrations: 1, seatHolds: 0 } } });
    expect(await deleteIaDay(1)).toMatchObject({ ok: false });
    db.iaDay.findUnique.mockResolvedValueOnce({ id: 1, date: "2027-01-23", journee: 1, cohortId: 7, _count: { seats: 0 }, cohort: { id: 7, _count: { registrations: 0, seatHolds: 0 } } });
    expect(await deleteIaDay(1)).toMatchObject({ ok: true });
    expect(db.tx.iaDay.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(db.tx.cohort.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("lists the entries open for registration, with seats left, by date", async () => {
    const c = (id: number, startsAt: string, confirmedCount: number) => ({ id, program: "ia", name: "", startsAt: new Date(startsAt), capacity: 12, status: "open", confirmedCount, heldCount: 0 });
    reg.loadOpenCohorts.mockResolvedValue([c(2, "2027-02-06T15:00:00Z", 3), c(1, "2027-01-23T15:00:00Z", 0), c(3, "2027-02-20T15:00:00Z", 12)]);
    db.iaDay.findMany.mockResolvedValue([{ cohortId: 2, date: "2027-02-06", start: "10:00" }, { cohortId: 1, date: "2027-01-23", start: "10:00" }]);
    const entries = await openIaEntries(now);
    expect(entries.map((e) => [e.cohortId, e.date, e.left])).toEqual([[1, "2027-01-23", 12], [2, "2027-02-06", 9]]);
    expect(db.iaDay.findMany.mock.calls.at(-1)![0].where).toEqual({ cohortId: { in: [2, 1] }, closed: false });
  });
});
