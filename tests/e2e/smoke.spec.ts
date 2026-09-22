import { expect, test } from "@playwright/test";

test("la page d'accueil s'affiche en français avec une seule action", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/CISSP/);
  await expect(page.getByRole("link", { name: /analyser mon profil/i }).first()).toBeVisible();
  // The questionnaire is on the page itself, opening on the experience question.
  await expect(page.getByRole("heading", { name: /années d'expérience/i })).toBeVisible();
});

test("l'admin est protégé et renvoie vers la connexion", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/connexion/);
  await expect(page.getByRole("button", { name: /se connecter avec google/i })).toBeVisible();
});
