import { expect, test, type Page } from "@playwright/test";

/** Terminal states an assistant turn can end in; the free router's daily cap makes "failed" a normal outcome. */
async function waitForTerminalTurn(page: Page): Promise<"completed" | "failed"> {
  const failed = page.getByText("Agent failed to complete this response. Please try again.");
  const footer = page.getByText(/\d\.\d\dM credits|<0\.01M credits/).first();
  await expect.poll(async () => (await failed.count()) > 0 || (await footer.count()) > 0, { timeout: 120_000, message: "the assistant turn never reached a terminal state" }).toBe(true);
  return (await failed.count()) > 0 ? "failed" : "completed";
}

test.describe("shell", () => {
  test("renders the sidebar navigation, top bar and empty state", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["New task", "Tasks", "API / MCP"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    for (const label of ["Library", "Tools"]) await expect(nav.getByRole("button", { name: label })).toBeVisible();
    await expect(page.getByText("Recent tasks")).toBeVisible();
    await expect(page.getByRole("button", { name: /Model: OpenRouter Free/ })).toBeVisible();
    await expect(page.getByText(/\d+\.\d\dM|<0\.01M/).first()).toBeVisible(); // credits pill
    await expect(page.getByRole("heading", { name: "Your AI worker" })).toBeVisible();
    await expect(page.getByText("Work at the speed of thought.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveAttribute("placeholder", "Assign a task or ask anything...");
  });

  test("a suggestion card fills the composer draft", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Generate an image/ }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).not.toHaveValue("");
  });

  test("⌘K opens search and ⌘B collapses the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.keyboard.press("Meta+b");
    await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
    await page.keyboard.press("Meta+b");
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });

  test("the Tools dialog lists the configured tools", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Tools" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/crop/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("a turn", () => {
  test("sends a message, reaches a terminal state, and survives a reload", async ({ page }) => {
    const text = `e2e smoke ${Date.now()}: reply with exactly one word: pong`;
    await page.goto("/");
    await page.getByRole("textbox", { name: "Message" }).fill(text);
    await page.getByRole("button", { name: "Send" }).click();

    // The send creates the chat and navigates to it; the user bubble appears optimistically.
    await expect(page).toHaveURL(/\/chat\/[a-z0-9]+$/, { timeout: 30_000 });
    // The chat title in the sidebar repeats the text, so scope the bubble check to the message log.
    const log = page.getByRole("log");
    await expect(log.getByText(text)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Recent tasks" }).getByRole("link", { name: new RegExp(text.slice(0, 20)) })).toBeVisible();

    const outcome = await waitForTerminalTurn(page);
    if (outcome === "failed") {
      await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    } else {
      await expect(page.getByText(/credits/).first()).toBeVisible();
    }

    // Reload recovery: everything above comes back from the database, not from memory.
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("log").getByText(text)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    if (outcome === "failed") await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
