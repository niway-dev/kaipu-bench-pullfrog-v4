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
const addImageButton: Step = {
  click: {
    area: "editorImage.addImage",
    part: { role: "button", name: "Add image", exact: true },
  },
};
const fromLibrary: Step = {
  click: {
    area: "editorImage.addImage",
    part: { role: "menuitem", name: "From Library", exact: true },
  },
};
const inspectToggle: Step = {
  click: { area: "editorImage.inspectToggle" },
};
const inspectColors: Step = {
  click: {
    area: "editorImage.inspectBar",
    part: { role: "button", name: "Colors", exact: true },
  },
};
const tool = (name: string): Step => ({
  click: { area: "editorImage.tools", part: { role: "button", name, exact: true } },
});

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
      // The flag is off in this profile: the `canvasView` area is not drawn, this is the other side.
      gates: [
        { flag: "image-canvas", side: "off" },
        { flag: "image-inspect", side: "off" },
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
      demonstrates: ["editorImage.canvasView:default", "editorImage.addImage:closed"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "add-image-menu": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” and press Add image: the menu offers New capture and From Library, and says pasting works too.",
      steps: [open(ASSETS.settingsShot), addImageButton],
      demonstrates: ["editorImage.addImage:open"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "library-picker": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page”, press Add image and choose From Library: the picker lists the other screenshots in the Library.",
      steps: [open(ASSETS.settingsShot), addImageButton, fromLibrary],
      demonstrates: ["editorImage.libraryPicker:open"],
      ready: { area: "editorImage.libraryPicker" },
    },
    "two-images": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page”, press Add image, choose From Library and click “Dashboard draft”: it lands to the right of the screenshot, selected.",
      steps: [
        open(ASSETS.settingsShot),
        addImageButton,
        fromLibrary,
        {
          click: {
            area: "editorImage.libraryPicker",
            part: { role: "button", name: "Dashboard draft", exact: true },
          },
        },
        { waitFor: { area: "editorImage.libraryPicker", state: "hidden" } },
      ],
      demonstrates: ["editorImage.canvasView:twoImages"],
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
    "inspect-colors": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, then Colors: the panel lists the image's colors, largest first, with their share; a group with more than one exact value lists them under it.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        inspectColors,
        { waitFor: { area: "editorImage.inspectColors", part: { css: "ul" } } },
      ],
      demonstrates: ["editorImage.inspectColors:list"],
    },
    "inspect-colors-located": {
      profile: "image-inspect",
      how: "With the flag forced on, open “Settings page”, press Inspect, then Colors, and click the second color: the image dims everywhere except the pixels of that color.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        inspectColors,
        { waitFor: { area: "editorImage.inspectColors", part: { css: "ul" } } },
        { click: { area: "editorImage.inspectColors", part: { css: "li > button" }, nth: 1 } },
        {
          waitFor: { area: "editorImage.canvas", part: { css: "[data-testid='inspect-locate']" } },
        },
      ],
      demonstrates: ["editorImage.inspectColors:located"],
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
      "editorImage.libraryPicker:empty": nc(
        "needsSetup",
        "the picker leaves out the shot being edited, and the seeded vault holds three screenshots, so it always lists two; a vault with a single screenshot would show it (not built)",
      ),
      "editorImage.inspectColors:counting": nc(
        "transient",
        "the count of a catalog-sized image ends in well under a second, before a screenshot can be taken",
      ),
      "editorImage.inspectColors:error": nc(
        "inducedFailure",
        "shown only when the image cannot be decoded or the colors worker fails; the page tests pin it",
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
