import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the value of the latest committed render.
 *
 * Lets a callback read the current scene/controller without listing it as a dependency, so
 * the callback keeps one identity across scene changes and a memoised timeline lane that
 * receives it does not re-render on every slider move (NIW2-662). Read `.current` inside
 * the handler, never during render.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
