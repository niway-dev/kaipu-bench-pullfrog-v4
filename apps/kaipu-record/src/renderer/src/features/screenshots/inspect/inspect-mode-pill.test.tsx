import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectModePill } from "./inspect-mode-pill";

afterEach(() => {
  document.body.innerHTML = "";
});

const area = (): HTMLElement => document.querySelector("[data-ui-area='editorImage.inspectMode']")!;

describe("InspectModePill", () => {
  it("starts collapsed and opens the legend with ?", () => {
    render(<InspectModePill copied={false} readout={null} />);
    expect(area().getAttribute("data-legend")).toBe("false");
    expect(screen.getByRole("button", { name: "Show the keys" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    expect(area().getAttribute("data-legend")).toBe("true");
    expect(screen.getByText("outer size")).toBeTruthy();
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    expect(area().getAttribute("data-legend")).toBe("false");
  });

  it("opens from the hint and closes from the X", () => {
    render(<InspectModePill copied={false} readout={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Show the keys" }));
    expect(area().getAttribute("data-legend")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide the keys" }));
    expect(area().getAttribute("data-legend")).toBe("false");
  });

  it("ignores ? typed in a field, with a modal open, or with a modifier", () => {
    render(
      <>
        <input aria-label="field" />
        <InspectModePill copied={false} readout={null} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "?" });
    expect(area().getAttribute("data-legend")).toBe("false");
    fireEvent.keyDown(window, { key: "?", metaKey: true });
    expect(area().getAttribute("data-legend")).toBe("false");
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.append(modal);
    fireEvent.keyDown(window, { key: "?" });
    expect(area().getAttribute("data-legend")).toBe("false");
  });

  it("is replaced by the copied pill while a copy shows", () => {
    render(<InspectModePill copied readout="#F6055C" />);
    expect(area()).toBeNull();
    const copied = document.querySelector("[data-ui-area='editorImage.inspectCopied']")!;
    expect(copied.textContent).toContain("Copied");
    expect(copied.textContent).toContain("#F6055C");
  });
});
