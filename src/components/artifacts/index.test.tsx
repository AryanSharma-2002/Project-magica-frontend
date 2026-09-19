import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AssetBlock } from "@/contracts";
import { ArtifactPanel } from "./index";

const assets: AssetBlock[] = [
  { type: "asset", kind: "image", url: "https://x.test/1.png" },
  { type: "asset", kind: "image", url: "https://x.test/2.png" },
  { type: "asset", kind: "video", url: "https://x.test/3.mp4" },
];

describe("ArtifactPanel", () => {
  it("shows an empty state when there are no assets", () => {
    render(<ArtifactPanel assets={[]} open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/no generated assets yet/i)).toBeInTheDocument();
  });

  it("opens on the asset matching selectedUrl and shows its position", () => {
    render(<ArtifactPanel assets={assets} open onOpenChange={vi.fn()} selectedUrl="https://x.test/2.png" />);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates with the filmstrip and the on-screen arrows", async () => {
    const user = userEvent.setup();
    render(<ArtifactPanel assets={assets} open onOpenChange={vi.fn()} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view asset 3 of 3/i }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next asset/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /previous asset/i }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates with ArrowLeft/ArrowRight, clamped at the bounds", async () => {
    const user = userEvent.setup();
    render(<ArtifactPanel assets={assets} open onOpenChange={vi.fn()} />);

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("1 / 3")).toBeInTheDocument(); // clamped, doesn't go below 0

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument(); // clamped at the end
  });

  it("offers download and open-in-new-tab links for the selected asset", () => {
    render(<ArtifactPanel assets={assets} open onOpenChange={vi.fn()} selectedUrl="https://x.test/1.png" />);
    expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute("href", "https://x.test/1.png");
    expect(screen.getByRole("link", { name: /open asset in new tab/i })).toHaveAttribute("target", "_blank");
  });
});
