import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExtentsCompensation } from "./use-extents-compensation";

const none = { left: 0, top: 0, right: 0, bottom: 0 };
const outside = { left: 40, top: 0, right: 120, bottom: 0 };

type Props = { extents: typeof none; measured: boolean };

describe("useExtentsCompensation", () => {
  it("does not pan on the first measurement of a document that already has content outside", () => {
    const compensate = vi.fn();
    const { rerender } = renderHook(
      ({ extents, measured }: Props) => useExtentsCompensation(extents, measured, compensate),
      { initialProps: { extents: none, measured: false } as Props },
    );
    // The image has not laid out: extents are the zero placeholder. Then it is measured.
    rerender({ extents: outside, measured: true });
    expect(compensate).not.toHaveBeenCalled();
  });

  it("compensates for a change after the first measurement", () => {
    const compensate = vi.fn();
    const { rerender } = renderHook(
      ({ extents, measured }: Props) => useExtentsCompensation(extents, measured, compensate),
      { initialProps: { extents: none, measured: false } as Props },
    );
    rerender({ extents: outside, measured: true });
    const grown = { ...outside, right: 200 };
    rerender({ extents: grown, measured: true });
    expect(compensate).toHaveBeenCalledTimes(1);
    expect(compensate).toHaveBeenCalledWith(outside, grown);
  });

  it("treats a fresh open (no extents) as the baseline too", () => {
    const compensate = vi.fn();
    const { rerender } = renderHook(
      ({ extents, measured }: Props) => useExtentsCompensation(extents, measured, compensate),
      { initialProps: { extents: none, measured: true } as Props },
    );
    rerender({ extents: outside, measured: true });
    expect(compensate).toHaveBeenCalledWith(none, outside);
  });
});
