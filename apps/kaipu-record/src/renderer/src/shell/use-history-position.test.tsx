import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createHashRouter, Link, RouterProvider, useNavigate } from "react-router-dom";
import { resetHistoryPositionForTests, useHistoryPosition } from "./use-history-position";

function Page({ name }: { name: string }): React.JSX.Element {
  const { canGoBack, canGoForward } = useHistoryPosition();
  const navigate = useNavigate();
  return (
    <div>
      <h1>{name}</h1>
      <output data-testid="position">{`${canGoBack}/${canGoForward}`}</output>
      <Link to="/a">to a</Link>
      <Link to="/b">to b</Link>
      <button type="button" onClick={() => navigate("/b", { replace: true })}>
        replace b
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        forward
      </button>
    </div>
  );
}

function mount(): void {
  const router = createHashRouter([
    { path: "/", element: <Page name="home" /> },
    { path: "/a", element: <Page name="a" /> },
    { path: "/b", element: <Page name="b" /> },
  ]);
  render(<RouterProvider router={router} />);
}

const position = (): string => screen.getByTestId("position").textContent ?? "";
const click = async (name: string): Promise<void> => {
  await act(async () => {
    screen.getByText(name).click();
  });
};
// jsdom runs history.go() on a later task and fires popstate itself: wait for that event.
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );
  });
};

afterEach(() => {
  cleanup();
  resetHistoryPositionForTests();
  window.history.replaceState(null, "", "#/");
});

describe("useHistoryPosition", () => {
  it("has nowhere to go on the first page", () => {
    mount();
    expect(position()).toBe("false/false");
  });

  it("can go back after a push, and forward again after going back", async () => {
    mount();
    await click("to a");
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(position()).toBe("true/false");
    await click("back");
    await settle();
    expect(position()).toBe("false/true");
    await click("forward");
    await settle();
    expect(position()).toBe("true/false");
  });

  it("drops the forward entries when a new page is pushed from the middle", async () => {
    mount();
    await click("to a");
    await click("back");
    await settle();
    expect(position()).toBe("false/true");
    await click("to b");
    expect(position()).toBe("true/false");
  });

  it("keeps its position across a replace", async () => {
    mount();
    await click("to a");
    await click("replace b");
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(position()).toBe("true/false");
  });
});
