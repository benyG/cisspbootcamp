import { expect, test } from "@playwright/test";

test("la page d'accueil s'affiche en français", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(
    page.getByRole("heading", { name: /bootcamp CISSP en français/i }),
  ).toBeVisible();
});

test("l'admin est protégé et renvoie vers la connexion", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/connexion/);
  await expect(
    page.getByRole("button", { name: /se connecter avec google/i }),
  ).toBeVisible();
});
