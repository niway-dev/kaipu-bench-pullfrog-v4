import { ASSETS } from "../fixtures/seed-vault";
import { catalog, type Step } from "../types";
import { nc } from "./not-capturable";

const open = (assetId: string): Step => ({ navigate: `/editor/image/${assetId}` });
const zoomOut: Step = {
  click: { area: "editorImage.canvas", part: { role: "button", name: "Zoom out", exact: true } },
};
const theme = (value: "light" | "dark"): Step => ({
  call: "updateSettings",
  args: [{ theme: value }],
});
const inspectToggle: Step = {
  click: { area: "editorImage.inspectToggle" },
};
const tool = (name: string): Step => ({
  click: { area: "editorImage.tools", part: { role: "button", name, exact: true } },
});

/** Open the screenshot that draws real text and pick Select text, as `ready` and `selected` start. */
const openText: readonly Step[] = [
  open(ASSETS.textShot),
  tool("Select text"),
  {
    waitFor: { area: "editorImage.textStatus", part: { text: "words found" } },
    // The first recognition on a Mac compiles Vision's model: 13.5 s measured, so allow more.
    timeoutMs: 60_000,
  },
];

/** The image editor on a saved screenshot (`#/editor/image/:assetId`). */
export const editorImage = catalog(
  "editorImage",
  {
    saved: {
      profile: "default",
      how: "Open “Settings page”, a saved screenshot, in the image editor.",
      steps: [open(ASSETS.settingsShot)],
      demonstrates: [
        "editorImage.page:saved",
        "editorImage.toolbar:default",
        "editorImage.tools:select",
        "editorImage.canvas:default",
        "editorImage.beautify:default",
      ],
      // The flags are off in this profile: the `canvasView`, Inspect and Select text areas are
      // not drawn, this is the other side.
      gates: [
        { flag: "image-canvas", side: "off" },
        { flag: "image-inspect", side: "off" },
        { flag: "image-text", side: "off" },
      ],
    },
    "tool-box": {
      profile: "default",
      steps: [open(ASSETS.settingsShot), tool("Box")],
      demonstrates: ["editorImage.tools:annotate", "editorImage.canvas:annotate"],
    },
    "tool-step": {
      profile: "default",
      how: "Open “Settings page”, pick Step and click the canvas: a badge numbered 1 appears.",
      steps: [open(ASSETS.settingsShot), tool("Step"), { click: { area: "editorImage.canvas" } }],
      demonstrates: ["editorImage.tools:step", "editorImage.canvas:step"],
    },
    "tool-crop": {
      profile: "default",
      steps: [open(ASSETS.settingsShot), tool("Crop")],
      demonstrates: ["editorImage.tools:crop", "editorImage.canvas:crop"],
    },
    "toolbar-saved": {
      profile: "default",
      how: "Open “Error dialog”, press Save and answer Overwrite: the Save button turns into Saved.",
      steps: [
        open(ASSETS.dialogShot),
        {
          click: {
            area: "editorImage.toolbar",
            part: { role: "button", name: "Save", exact: true },
          },
        },
        { click: { area: "editorImage.page", part: { role: "button", name: "Overwrite" } } },
        {
          waitFor: {
            area: "editorImage.toolbar",
            part: { role: "button", name: "Saved", exact: true },
          },
        },
      ],
      demonstrates: ["editorImage.toolbar:saved"],
    },
    "canvas-default": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” in the image editor: the canvas is marked as the flag's content-box canvas.",
      steps: [open(ASSETS.settingsShot)],
      demonstrates: ["editorImage.canvasView:default"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "canvas-zoomed-out": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” and press Zoom out once: the zoom goes below 100%.",
      steps: [open(ASSETS.settingsShot), zoomOut],
      demonstrates: ["editorImage.canvasView:zoomedOut"],
    },
    "redaction-blur": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” and pick the Blur tool: the panel offers Blur (selected) and Solid, with the note that only Solid hides content for certain.",
      steps: [open(ASSETS.settingsShot), tool("Blur")],
      demonstrates: ["editorImage.redactionStyle:blur"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "redaction-solid": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page”, pick the Blur tool and press Solid in the panel: Solid is now the selected style.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Blur"),
        {
          click: {
            area: "editorImage.redactionStyle",
            part: { role: "button", name: "Solid", exact: true },
          },
        },
      ],
      demonstrates: ["editorImage.redactionStyle:solid"],
    },
    "inspect-off": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”: the Inspect button is in the toolbar, off.",
      steps: [open(ASSETS.settingsShot)],
      demonstrates: ["editorImage.inspectToggle:off"],
      gates: [{ flag: "image-inspect", side: "on" }],
    },
    "inspect-on": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page” and press Inspect: the button turns on and the Inspect bar replaces the tool options.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        { waitFor: { area: "editorImage.inspectBar" } },
      ],
      demonstrates: [
        "editorImage.inspectToggle:on",
        "editorImage.inspectBar:hex",
        "editorImage.inspectRuler:off",
      ],
    },
    "inspect-as-captured": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, then As captured: HSL and OKLCH are disabled because the raw bytes are not sRGB.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        {
          click: {
            area: "editorImage.inspectBar",
            part: { role: "button", name: "As captured", exact: true },
          },
        },
      ],
      demonstrates: ["editorImage.inspectBar:asCaptured"],
    },
    "inspect-hud": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect and rest the pointer on the image: the loupe and colour chip appear beside it.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        { hover: { area: "editorImage.canvas" } },
        { waitFor: { area: "editorImage.inspectHud" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectHud:reading"],
    },
    "inspect-ruler": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press 1: the horizontal pixel run under the cursor is drawn with its length, and Horizontal is on in the bar.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        { hover: { area: "editorImage.canvas" } },
        { waitFor: { area: "editorImage.inspectHud" } },
        { press: "1" },
        { waitFor: { area: "editorImage.inspectRun" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRuler:horizontal", "editorImage.inspectRun:horizontal"],
    },
    "inspect-ruler-vertical": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press 2: the vertical pixel run under the cursor is drawn with its length beside it, and Vertical is on in the bar.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        { hover: { area: "editorImage.canvas" } },
        { waitFor: { area: "editorImage.inspectHud" } },
        { press: "2" },
        { waitFor: { area: "editorImage.inspectRun" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRuler:vertical", "editorImage.inspectRun:vertical"],
    },
    "inspect-measure-pinned": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image, press 1 and click: the run stays on the image as a measurement with its length.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        { hover: { area: "editorImage.canvas" } },
        { waitFor: { area: "editorImage.inspectHud" } },
        { press: "1" },
        { waitFor: { area: "editorImage.inspectRun" } },
        { click: { area: "editorImage.canvas" } },
        { waitFor: { area: "editorImage.measure" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.measure:pinned"],
    },
    "text-none": {
      profile: "image-text",
      how: "With the flag forced on, open “Settings page” (a drawing with no text) and pick the Select text tool: once recognition finishes, the panel says no text was found.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Select text"),
        {
          waitFor: {
            area: "editorImage.textStatus",
            part: { text: "No text found", exact: true },
          },
          // The first recognition on a Mac compiles Vision's model, which can take a while.
          timeoutMs: 45_000,
        },
      ],
      demonstrates: ["editorImage.textStatus:noText"],
      gates: [{ flag: "image-text", side: "on" }],
    },
    "text-ready": {
      profile: "image-text",
      how: "With the flag forced on, open “Display settings” (a screenshot of a settings panel with real text) and pick the Select text tool: once recognition finishes, the panel counts the words found and offers Select all and Copy text.",
      steps: openText,
      demonstrates: ["editorImage.textStatus:ready"],
      gates: [{ flag: "image-text", side: "on" }],
    },
    "text-selected": {
      profile: "image-text",
      how: "With the flag forced on, open “Display settings”, pick Select text and drag across its first row (“Language: English”): the words under the drag are highlighted on the image.",
      steps: [
        ...openText,
        {
          drag: { area: "editorImage.textSelection" },
          // The fixture is 560x340 px; the first row's text spans x 44-170 at y 92-108.
          from: { x: 60 / 560, y: 100 / 340 },
          to: { x: 190 / 560, y: 100 / 340 },
        },
        {
          waitFor: {
            area: "editorImage.textSelection",
            part: { css: "[data-testid=text-highlights]" },
          },
        },
      ],
      demonstrates: ["editorImage.textSelection:selected"],
    },
    "canvas-light": {
      profile: "image-canvas",
      how: "With the flag forced on, switch to the light theme and open “Settings page”: the canvas's dot grid takes the light colours.",
      steps: [theme("light"), open(ASSETS.settingsShot)],
      demonstrates: ["editorImage.canvasView:light"],
      gates: [{ setting: "theme", side: "light" }],
      after: [theme("dark")],
    },
  },
  {
    notCapturable: {
      "editorImage.textStatus:pending": nc(
        "transient",
        "recognition settles in well under a second on a drawing, and the catalog cannot slow the helper; the panel reads “Recognizing text…” until then",
      ),
      "editorImage.textStatus:unavailable": nc(
        "inducedFailure",
        "showing it needs a run without the recognition helper; the catalog could only get that with a test-only override of the helper path in production code (or by deleting the helper on the runner), and the real-app proof `verify/image-text.verify.ts` covers it by renaming the helper away",
      ),
      "editorImage.canvasView:exportFrame": nc(
        "needsSetup",
        "the export frame is set by dragging the crop rectangle, and the catalog steps cannot drag; a fixture that starts from a saved frame would show it (not built)",
      ),
      "editorImage.canvasView:contentOutside": nc(
        "needsSetup",
        "content past the image edge needs a click outside the image, and the catalog clicks only the centre of an area; a fixture with an annotation past the edge would show it (not built)",
      ),
    },
  },
);
