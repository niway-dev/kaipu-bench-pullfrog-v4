import { catalog } from "../types";

/** The Shortcuts page (`#/shortcuts`): the global keyboard shortcuts, each rebindable. */
export const shortcuts = catalog("shortcuts", {
  default: {
    profile: "default",
    steps: [{ navigate: "/shortcuts" }],
    demonstrates: ["shortcuts.page:default", "shortcuts.list:default"],
  },
  conflict: {
    profile: "default",
    how: "Click the first shortcut (the screenshot widget key) and press the combination Bring Kaipu to front uses: the page refuses it and names the action that owns it.",
    steps: [
      { navigate: "/shortcuts" },
      { click: { area: "shortcuts.list", part: { role: "button", name: "Change shortcut" } } },
      { press: "Meta+Control+O" },
      { waitFor: { area: "shortcuts.list", part: { text: "already bound to" } } },
    ],
    demonstrates: ["shortcuts.list:conflict"],
  },
});
