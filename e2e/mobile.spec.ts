import { expect, test } from "@playwright/test";

test.describe("mobile layout", () => {
  test("hides the sidebar behind an open-sidebar button and keeps the composer usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Model: OpenRouter Free/ })).toBeVisible();
  });
});
