import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@/test/query-client";
import "@/test/dom-polyfills";
import { TopBar } from "./top-bar";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function renderTopBar() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <TopBar />
    </QueryClientProvider>,
  );
}

describe("TopBar", () => {
  it("shows the model selector with its status label in the popover", async () => {
    pathname = "/";
    renderTopBar();
    const user = userEvent.setup();

    expect(await screen.findByText("OpenRouter Free")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /model: openrouter free, available/i }));
    expect(await screen.findByText("Available")).toBeInTheDocument();
  });

  it("formats the credits pill via formatCredits", async () => {
    pathname = "/";
    renderTopBar();
    expect(await screen.findByText("100.00M")).toBeInTheDocument();
  });

  it("hides the files toggle on the new-task route and shows it on a chat route", async () => {
    pathname = "/";
    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <TopBar />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: /files panel/i })).not.toBeInTheDocument();
    unmount();

    pathname = "/chat/chat_1";
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <TopBar />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: /files panel/i })).toBeInTheDocument();
  });
});
