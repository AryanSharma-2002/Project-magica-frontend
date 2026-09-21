import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ToolDescriptor } from "@/contracts";
import { server } from "@/test/msw/server";
import { API, fixtures } from "@/test/msw/handlers";
import { createTestQueryClient } from "@/test/query-client";
import "@/test/dom-polyfills";
import { SidebarNav } from "./sidebar-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const DOCS_FALLBACK_URL = "https://agent-chat-backend-tan.vercel.app/api/v1/health";

function renderNav() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <SidebarNav />
    </QueryClientProvider>,
  );
}

describe("SidebarNav destinations", () => {
  it("New task and Tasks both link to /", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "New task" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/");
  });

  it("renders a Library entry point that opens the media picker", async () => {
    renderNav();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(await screen.findByRole("tab", { name: "Uploads" })).toBeInTheDocument();
  });

  it("API / MCP links to the docs fallback URL in a new tab when NEXT_PUBLIC_DOCS_URL is unset", () => {
    renderNav();
    const link = screen.getByRole("link", { name: "API / MCP" });
    expect(link).toHaveAttribute("href", DOCS_FALLBACK_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("hides Help & Support when NEXT_PUBLIC_SUPPORT_EMAIL is unset (fallback hidden, not disabled)", () => {
    renderNav();
    expect(screen.queryByText("Help & Support")).not.toBeInTheDocument();
  });

  it("Tools opens a dialog listing config.tools labels and descriptions", async () => {
    const tool: ToolDescriptor = {
      name: "crop_image",
      label: "Crop image",
      description: "Crop an image to a rectangle.",
      group: "media",
      creditModel: { type: "free" },
      requiresApproval: "never",
      inputSchema: {},
      outputSchema: {},
      execution: "inline",
    };
    server.use(http.get(`${API}/config`, () => HttpResponse.json({ ...fixtures.config, tools: [tool] })));

    renderNav();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Tools" }));

    expect(await screen.findByRole("dialog", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByText("Crop image")).toBeInTheDocument();
    expect(screen.getByText("Crop an image to a rectangle.")).toBeInTheDocument();
  });
});
