import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextNotice, TextShimmer, READING_NOTICE_DELAY_MS, UNAVAILABLE_NOTICE_MS } from "./text-notice";

describe("TextNotice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const props = { enabled: true, loaded: true, wide: false } as const;

  it("shows 'reading' only after 300 ms pending, with the shimmer", () => {
    render(
      <>
        <TextNotice {...props} status="pending" />
        <TextShimmer enabled loaded status="pending" />
      </>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    act(() => void vi.advanceTimersByTime(READING_NOTICE_DELAY_MS));
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "reading");
    expect(screen.getByTestId("text-shimmer")).toBeInTheDocument();
  });

  it("never flashes for a result that arrives within 300 ms", () => {
    const { rerender } = render(<TextNotice {...props} status="pending" />);
    act(() => void vi.advanceTimersByTime(READING_NOTICE_DELAY_MS - 1));
    rerender(<TextNotice {...props} status="ready" />);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says unavailable, then goes away after 6 s", () => {
    render(<TextNotice {...props} status="unavailable" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "unavailable");
    act(() => void vi.advanceTimersByTime(UNAVAILABLE_NOTICE_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows nothing with the flag off or the image not loaded", () => {
    const { rerender } = render(<TextNotice {...props} enabled={false} status="unavailable" />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<TextNotice {...props} loaded={false} status="unavailable" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
