import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "./toast";
import { dismissToast, getToasts, showToast } from "./toast-store";

afterEach(() => {
  for (const t of getToasts()) dismissToast(t.id);
});

describe("ToastHost", () => {
  it("renders an active toast's message", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "No pudimos guardar la grabación." });
    });
    expect(screen.getByText("No pudimos guardar la grabación.")).toBeInTheDocument();
  });

  it("invokes the retry action and dismisses on click", async () => {
    const retry = vi.fn();
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Falló", action: { label: "Reintentar", onClick: retry } });
    });
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders a toast's detail line under its message, with or without the success check", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Text copied", detail: "2 lines" });
      showToast({ message: "Image added", detail: "from the library", tone: "success" });
    });
    expect(screen.getByText("2 lines")).toBeInTheDocument();
    expect(screen.getByText("from the library")).toBeInTheDocument();
  });

  it("draws a check before a success toast's message and none otherwise", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Hecho", tone: "success" });
    });
    expect(screen.getByTestId("toast-success-icon")).toBeInTheDocument();
    act(() => {
      for (const t of getToasts()) dismissToast(t.id);
      showToast({ message: "Plain" });
    });
    expect(screen.queryByTestId("toast-success-icon")).toBeNull();
  });
});
