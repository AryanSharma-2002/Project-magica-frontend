import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CancelledCard, FailedCard, CANCELLED_MESSAGE, FAILED_FALLBACK_MESSAGE } from "./failed-card";

describe("FailedCard", () => {
  it("renders the error block's message and calls onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<FailedCard error={{ code: "provider_error", message: "Media provider rejected the request", retryable: false }} onRetry={onRetry} />);

    expect(screen.getByText("Media provider rejected the request")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to the safe copy when there is no error block", () => {
    render(<FailedCard />);
    expect(screen.getByText(FAILED_FALLBACK_MESSAGE)).toBeInTheDocument();
  });

  it("omits Retry when no handler is given", () => {
    render(<FailedCard error={{ code: "internal", message: "boom", retryable: false }} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});

describe("CancelledCard", () => {
  it("renders the cancelled copy with no Retry button", () => {
    render(<CancelledCard />);
    expect(screen.getByText(CANCELLED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
