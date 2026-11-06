import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the value of the latest committed render.
 *
 * Lets a callback read the current scene/controller without listing it as a dependency, so
 * the callback keeps one identity across scene changes and a memoised timeline lane that
 * receives it does not re-render on every slider move (NIW2-662). Read `.current` inside
 * the handler, never during render. The write happens in the owner's layout effect, which runs
 * after its children's layout effects: a child that called a handler from its own layout
 * effect would read the previous render's value. Pointer and keyboard handlers run later and
 * always see the latest.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
