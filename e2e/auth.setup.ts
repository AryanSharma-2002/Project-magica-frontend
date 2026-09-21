import { clerk } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

const email = process.env.E2E_CLERK_USER_EMAIL;

/**
 * Signs the reviewer account in once and saves the browser state for every other project. Uses a
 * Clerk sign-in ticket created through the Backend API (no password in the environment).
 */
setup("sign in as the reviewer account", async ({ page }) => {
  if (!email) throw new Error("Set E2E_CLERK_USER_EMAIL to the reviewer account's email address.");
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your AI worker" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
