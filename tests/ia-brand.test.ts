import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { IA_SENDER, IA_SIGNATURE, senderFor, signatureFor, withSenderName } from "@/lib/ia-brand";
import { balanceReminderEmail } from "@/lib/balance-reminders";
import { resultEmail } from "@/lib/ia-diagnostic-server";
import { ACTIVITIES, EASE, HOURS, type IaAnswers, TASKS, TOOLS, diagnose } from "@/lib/ia-diagnostic";

describe("Bâtisseur IA voice (ExamBoot, not Ben)", () => {
  it("signs IA e-mails with the team and keeps Ben on the CISSP side", () => {
    expect(signatureFor("ia", "Ben")).toBe(IA_SIGNATURE);
    expect(IA_SIGNATURE).toContain("ExamBoot");
    expect(signatureFor("cissp", "Ben\nCoach CISSP")).toBe("Ben\nCoach CISSP");
    expect(senderFor("ia")).toBe(IA_SENDER);
    expect(senderFor("cc")).toBeUndefined();
  });

  it("changes the sender's display name, never its address", () => {
    expect(withSenderName("CISSP Bootcamp <bonjour@cisspbootcamp.online>", IA_SENDER)).toBe("Bâtisseur IA · ExamBoot <bonjour@cisspbootcamp.online>");
    expect(withSenderName("bonjour@cisspbootcamp.online", "Bâtisseur IA")).toBe("Bâtisseur IA <bonjour@cisspbootcamp.online>");
    expect(withSenderName("CISSP Bootcamp <bonjour@cisspbootcamp.online>", undefined)).toBe("CISSP Bootcamp <bonjour@cisspbootcamp.online>");
  });

  it("writes the diagnostic e-mail and the IA balance reminder without Ben", () => {
    const first = <T extends object>(o: T) => Object.keys(o)[0] as keyof T;
    const answers: IaAnswers = { activity: first(ACTIVITIES), tasks: (Object.keys(TASKS) as IaAnswers["tasks"]).slice(0, 3), hours: first(HOURS), tools: first(TOOLS), ease: first(EASE) };
    const d = diagnose(answers);
    expect(d.ready).toBe(false);
    const mail = resultEmail("Awa", d, "t".repeat(24), "u".repeat(24));
    expect(mail.text).not.toMatch(/\bBen\b|avec moi/);
    expect(mail.text).toContain(IA_SIGNATURE);
    const reminder = balanceReminderEmail({ program: "ia", firstName: "Awa", programName: "Bâtisseur IA", cohortName: "Entrée du 9 janvier", balanceUsd: 31000, startsAt: new Date("2027-01-09T15:00:00Z"), reference: "IA-ABC", unsubscribeToken: "u".repeat(24), last: false });
    expect(reminder.text).not.toMatch(/\bBen\b/);
    const cissp = balanceReminderEmail({ program: "cissp", firstName: "Awa", programName: "CISSP Bootcamp", cohortName: "Cohorte de janvier", balanceUsd: 31000, startsAt: new Date("2027-01-09T15:00:00Z"), reference: "CB-ABC", unsubscribeToken: "u".repeat(24), last: false });
    expect(cissp.text).toMatch(/\bBen\b/);
  });

  it("never names Ben on the IA public pages", () => {
    const files = [
      "app/(public)/ia/page.tsx",
      "app/(public)/ia/diagnostic/page.tsx",
      "app/(public)/ia/diagnostic/resultat/[token]/page.tsx",
      "app/(public)/ia/guide/page.tsx",
      "app/(public)/ia/inscription/page.tsx",
      "app/(public)/ia/calendrier/[token]/page.tsx",
      "components/ia/Diagnostic.tsx",
      "components/ia/BriefForm.tsx",
      "components/ia/Planner.tsx",
      "components/ia/shell.tsx",
      "components/ia/landing/LiveSession.tsx",
      "components/ia/landing/IaQuote.tsx",
      "components/ia/landing/BuildScrubber.tsx",
      "lib/ia-landing.ts",
      "lib/ia-days.ts",
    ];
    for (const file of files) {
      // Code comments may credit Ben's decisions; what visitors read may not.
      const visible = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(visible, file).not.toMatch(/\bBen\b/);
    }
  });
});

describe("Bâtisseur IA share image", () => {
  it("names ExamBoot, not Ben, and has no portrait", async () => {
    const { IA_SHARE_ALT } = await import("@/lib/og/ia-share-image");
    expect(IA_SHARE_ALT).toContain("ExamBoot");
    expect(IA_SHARE_ALT).not.toMatch(/\bBen\b/);
    expect(readFileSync("lib/og/ia-share-image.tsx", "utf8")).not.toContain("coach.png");
  });
});
