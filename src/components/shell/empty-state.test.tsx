import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/dom-polyfills";
import { useComposerStore } from "@/stores/composer";
import { EmptyState } from "./empty-state";

afterEach(() => {
  useComposerStore.setState({ drafts: {}, attachments: {}, planMode: false });
});

describe("EmptyState", () => {
  it("renders the composer slot unchanged and the h1/subtitle copy", () => {
    render(
      <EmptyState chatId={null}>
        <div data-testid="composer-slot">composer</div>
      </EmptyState>,
    );
    expect(screen.getByTestId("composer-slot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your AI worker" })).toBeInTheDocument();
    expect(screen.getByText("Work at the speed of thought.")).toBeInTheDocument();
  });

  it("fills the composer draft for the active chat when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmptyState chatId={null}>
        <div />
      </EmptyState>,
    );

    await user.click(screen.getByRole("button", { name: /start a task: generate an image/i }));

    expect(useComposerStore.getState().drafts.new).toBe("Generate an image");
  });

  it("filters suggestions by tab and keeps the tabs functional (not dead controls)", async () => {
    const user = userEvent.setup();
    render(
      <EmptyState chatId={null}>
        <div />
      </EmptyState>,
    );

    expect(screen.getByRole("button", { name: /start a task: generate an image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a task: merge two videos/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Video" }));

    expect(screen.queryByRole("button", { name: /start a task: generate an image/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a task: merge two videos/i })).toBeInTheDocument();
  });
});
