import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@/test/query-client";
import "@/test/dom-polyfills";
import { SidebarNav } from "./sidebar-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

// `vi.mock` factories are hoisted above imports, so this replaces the real (env-var-parsing)
// module before `SidebarNav` (and its `env` import) is ever evaluated.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://api.test",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_dummy",
    NEXT_PUBLIC_TRIGGER_API_URL: "https://api.trigger.dev",
    NEXT_PUBLIC_DOCS_URL: "https://docs.example.com",
    NEXT_PUBLIC_SUPPORT_EMAIL: "help@example.com",
  },
}));

function renderNav() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <SidebarNav />
    </QueryClientProvider>,
  );
}

describe("SidebarNav with support email configured", () => {
  it("shows Help & Support as a mailto link", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Help & Support" })).toHaveAttribute("href", "mailto:help@example.com");
  });

  it("uses NEXT_PUBLIC_DOCS_URL for API / MCP instead of the fallback", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "API / MCP" })).toHaveAttribute("href", "https://docs.example.com");
  });
});
