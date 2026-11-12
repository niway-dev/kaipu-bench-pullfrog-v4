import { ASSETS } from "../fixtures/seed-vault";
import { catalog, type Step } from "../types";
import { nc } from "./not-capturable";

const open = (assetId: string): Step => ({ navigate: `/editor/image/${assetId}` });
const zoomOut: Step = {
  click: { area: "editorImage.canvas", part: { role: "button", name: "Zoom out", exact: true } },
};
const zoomIn: Step = {
  click: { area: "editorImage.canvas", part: { role: "button", name: "Zoom in", exact: true } },
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
/**
 * The runner sizes the window after the steps, so a step that needs the compact toolbar
 * (a menu only it has) shrinks the window first.
 */
const compactWindow: Step = { window: "editor-image-min" };
/** The compact toolbar (mock B3): a button of the toolbar, by its accessible name. */
const toolbarButton = (name: string): Step => ({
  click: { area: "editorImage.toolbar", part: { role: "button", name, exact: true } },
});

/** Inspect states from the mocks (C1-C12): the pointer rests on the canvas and the HUD shows. */
const hoverCanvas: Step = { hover: { area: "editorImage.canvas" } };
const hudShown: Step = { waitFor: { area: "editorImage.inspectHud" } };
const runShown: Step = { waitFor: { area: "editorImage.inspectRun" } };
const inspectButton = (name: string): Step => ({
  click: { area: "editorImage.inspectBar", part: { role: "button", name, exact: true } },
});
/** The HUD, aimed by a point of the canvas box (fractions), which the Inspect layer covers. */
const hoverAt = (x: number, y: number, part?: { css: string }): Step => ({
  hover: { area: "editorImage.canvas", ...(part ? { part } : {}) },
  at: { x, y },
});
const clickAt = (x: number, y: number): Step => ({
  click: { area: "editorImage.canvas" },
  at: { x, y },
});
const inCanvas = (css: string) => ({
  waitFor: { area: "editorImage.canvas" as const, part: { css } },
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
    toolbar: {
      profile: "image-toolbar",
      how: "Mock B1: with the three image-editor flags forced on, open “Settings page” at the editor's default size: the toolbar reads mode switch (Annotate | Inspect), Select Pen Box Arrow Text Step, Redact, Export frame, Add image, Select text, Undo Redo, the title, then Copy, Save and PDF.",
      steps: [open(ASSETS.settingsShot)],
      demonstrates: ["editorImage.toolbar:default"],
    },
    "toolbar-tooltip": {
      profile: "image-toolbar",
      how: "Mock B2: with the three image-editor flags forced on, open “Settings page” and rest the pointer on the Step tool: a tooltip names it and shows its key, N.",
      steps: [
        open(ASSETS.settingsShot),
        {
          hover: {
            area: "editorImage.tools",
            part: { role: "button", name: "Step", exact: true },
          },
        },
        { waitFor: { area: "editorImage.toolbar", part: { css: "[role='tooltip']" } } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.toolbar:tooltip"],
    },
    "toolbar-compact": {
      profile: "image-toolbar",
      // The smallest window the image editor allows (720×560). Compact needs the editor page
      // under 1000 px.
      window: "editor-image-min",
      how: "Mock B3: with the three image-editor flags forced on, open “Settings page” in a narrow window: Pen, Box, Arrow, Text and Step are one Draw menu, the rest sit in the ••• menu, the title is gone and the right panel is behind its toggle.",
      steps: [open(ASSETS.settingsShot)],
      demonstrates: [
        "editorImage.toolbar:compact",
        "editorImage.drawMenu:closed",
        "editorImage.moreMenu:closed",
        "editorImage.panelToggle:closed",
      ],
    },
    "toolbar-compact-draw-menu": {
      profile: "image-toolbar",
      window: "editor-image-min",
      how: "Mock B3: with the three image-editor flags forced on, open “Settings page” in a narrow window and press Draw: the menu lists Pen, Box, Arrow, Text and Step with their keys.",
      steps: [open(ASSETS.settingsShot), compactWindow, toolbarButton("Draw")],
      demonstrates: ["editorImage.drawMenu:open"],
    },
    "toolbar-compact-more-menu": {
      profile: "image-toolbar",
      window: "editor-image-min",
      how: "Mock B3: with the three image-editor flags forced on, open “Settings page” in a narrow window and press •••: the menu lists Export frame, Add image, Select text, Undo, Redo and PDF.",
      steps: [open(ASSETS.settingsShot), compactWindow, toolbarButton("More")],
      demonstrates: ["editorImage.moreMenu:open"],
    },
    "toolbar-compact-panel": {
      profile: "image-toolbar",
      window: "editor-image-min",
      how: "Mock B3: with the three image-editor flags forced on, open “Settings page” in a narrow window and press the panel toggle: the Beautify panel opens as a sheet over the stage's right edge.",
      steps: [open(ASSETS.settingsShot), compactWindow, toolbarButton("Panel")],
      demonstrates: ["editorImage.panelToggle:open"],
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
    "canvas-off-content": {
      profile: "image-canvas",
      how: "Mock A6: with the flag forced on, open “Settings page”, zoom in three steps and turn the mouse wheel over the canvas toward the right and down until less than half of the content is on stage: a notice says where the content went.",
      steps: [
        open(ASSETS.settingsShot),
        zoomIn,
        zoomIn,
        zoomIn,
        // A plain wheel pans (Ctrl or Cmd would zoom); a positive delta moves the view right
        // and down. The pan stops with 64 px of the content still on stage.
        { wheel: { area: "editorImage.canvas" }, deltaX: 600, deltaY: 600, times: 6 },
        { waitFor: { area: "editorImage.offContentNotice" } },
      ],
      demonstrates: ["editorImage.canvasView:offContent", "editorImage.offContentNotice:shown"],
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
      steps: [
        open(ASSETS.settingsShot),
        addImageButton,
        fromLibrary,
        // The list loads after the picker opens: wait for an item, not just the dialog.
        {
          waitFor: {
            area: "editorImage.libraryPicker",
            part: { role: "button", name: "Dashboard draft", exact: true },
          },
        },
      ],
      demonstrates: ["editorImage.libraryPicker:open"],
    },
    "two-images": {
      profile: "image-canvas",
      how: "Mock A4: with the flag forced on, open “Settings page”, press Add image, choose From Library and click “Dashboard draft”: it lands to the right of the screenshot, selected, with the accent frame, handles, the “Drag to move” tag and the gap to the screenshot.",
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
    "canvas-export-box": {
      profile: "image-canvas",
      how: "Mock A1: with the flag forced on, open “Settings page”: a dashed box surrounds the image, labelled EXPORT and the exact pixel size Copy and Save produce.",
      steps: [open(ASSETS.settingsShot), { waitFor: { area: "editorImage.exportBox" } }],
      demonstrates: ["editorImage.exportBox:labeled"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "canvas-export-box-quiet": {
      profile: "image-canvas",
      how: "Mock A1: with the flag forced on, open “Settings page” and pick the Redact tool: the dashed export box stays, its label is hidden.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Redact"),
        { waitFor: { area: "editorImage.exportBox" } },
      ],
      demonstrates: ["editorImage.exportBox:quiet"],
    },
    "canvas-beautified": {
      profile: "image-canvas",
      how: "Mock A2: with the flag forced on, open “Settings page”, pick the Sunset background and raise Padding to its maximum: the export box wraps the background and the padding, and the Beautify tip says the dotted canvas around them is not exported.",
      steps: [
        open(ASSETS.settingsShot),
        {
          click: {
            area: "editorImage.beautify",
            part: { role: "button", name: "Sunset", exact: true },
          },
        },
        // The first slider is Padding; End takes a range input to its maximum.
        {
          press: "End",
          target: { area: "editorImage.beautify", part: { role: "slider" }, nth: 0 },
        },
        { waitFor: { area: "editorImage.exportBox" } },
      ],
      demonstrates: ["editorImage.canvasView:beautified"],
    },
    "canvas-content-outside": {
      profile: "image-canvas",
      how: "Mock A3: with the flag forced on, open “Dashboard draft”, pick the Box tool and drag from inside the image to the empty canvas on its right: the export box and its label grow to include the box.",
      steps: [
        // Its own item: the box this drag adds is saved to the document, and a later state that
        // opens the same item would show it.
        open(ASSETS.dashboardShot),
        // At 100% the shot fills the stage; zoomed out, 97% of the stage is past its right edge.
        zoomOut,
        tool("Box"),
        {
          drag: { area: "editorImage.canvas" },
          from: { x: 0.55, y: 0.4 },
          to: { x: 0.97, y: 0.6 },
        },
      ],
      demonstrates: ["editorImage.canvasView:contentOutside"],
    },
    "canvas-export-frame": {
      profile: "image-canvas",
      how: "Mock A5: with the flag forced on, open “Settings page”, pick the Export frame tool and drag a rectangle inside the image: the outside is dimmed, the frame shows its handles and “W × H px · EXPORT FRAME”, and the card at the top left offers Fit to content and Remove.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Export frame"),
        {
          drag: { area: "editorImage.canvas" },
          from: { x: 0.42, y: 0.35 },
          to: { x: 0.62, y: 0.6 },
        },
        { waitFor: { area: "editorImage.exportFrameCard" } },
      ],
      demonstrates: ["editorImage.canvasView:exportFrame", "editorImage.exportFrameCard:open"],
    },
    "canvas-zoomed-out": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” and press Zoom out once: the zoom goes below 100%.",
      steps: [open(ASSETS.settingsShot), zoomOut],
      demonstrates: ["editorImage.canvasView:zoomedOut"],
    },
    "redaction-blur": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page” and pick the Redact tool: the panel offers Blur (selected) and Solid, with the note that only Solid hides content for certain.",
      steps: [open(ASSETS.settingsShot), tool("Redact")],
      demonstrates: ["editorImage.redactionStyle:blur"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "redaction-solid": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page”, pick the Redact tool and press Solid in the panel: Solid is now the selected style.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Redact"),
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
    "inspect-c1-loupe": {
      profile: "image-inspect",
      how: "Mock C1: with the flag forced on, open “Settings page”, press Inspect and rest the pointer on the image: the gridded loupe with its marked centre pixel, the colour chip with its format tag, and the mode pill at the foot of the canvas.",
      steps: [open(ASSETS.settingsShot), inspectToggle, hoverCanvas, hudShown],
      keepPointer: true,
      demonstrates: ["editorImage.inspectHud:reading", "editorImage.inspectMode:collapsed"],
    },
    "inspect-c2-format": {
      profile: "image-inspect",
      how: "Mock C2: with the flag forced on, open “Settings page”, press Inspect, choose OKLCH and As captured in the bar, then rest the pointer on the image: the chip reads in OKLCH and its tag says it is as captured.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        inspectButton("OKLCH"),
        inspectButton("As captured"),
        hoverCanvas,
        hudShown,
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectBar:asCaptured", "editorImage.inspectHud:reading"],
    },
    "inspect-c3-p3": {
      profile: "image-inspect",
      how: "Mock C3: with the flag forced on, open “P3 swatches”, a Display P3 sheet, press Inspect and rest the pointer on its teal swatch, which sRGB cannot show: the chip carries the P3 badge and the card under it explains the nearest sRGB color.",
      steps: [
        open(ASSETS.p3Shot),
        inspectToggle,
        hoverAt(0.1875, 0.75, { css: "img" }),
        hudShown,
        inCanvas("[data-ui-area='editorImage.inspectHud'][data-probed='true']"),
        { waitFor: { area: "editorImage.inspectHud", part: { text: "Out of sRGB" } } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectHud:reading"],
    },
    "inspect-c4-copied": {
      profile: "image-inspect",
      how: "Mock C4: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press C: the chip shows a check and the mode pill is replaced by “Copied” with the value.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "c" },
        { waitFor: { area: "editorImage.inspectCopied" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectCopied:shown"],
    },
    "inspect-c5-width": {
      profile: "image-inspect",
      how: "Mock C5: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press 1: the horizontal run is drawn with its length pill above it, and Width is on in the toolbar.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "1" },
        runShown,
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRuler:horizontal", "editorImage.inspectRun:horizontal"],
    },
    "inspect-c6-height": {
      profile: "image-inspect",
      how: "Mock C6: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press 2: the vertical run is drawn with its length pill beside it, and Height is on in the toolbar.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "2" },
        runShown,
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRuler:vertical", "editorImage.inspectRun:vertical"],
    },
    "inspect-c7-tolerance": {
      profile: "image-inspect",
      how: "Mock C7: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image, press 1 and turn the mouse wheel up three notches: the tolerance card with its progress bar appears beside the cursor and the toolbar's Tolerance value turns accent.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "1" },
        runShown,
        { wheel: { area: "editorImage.canvas" }, deltaY: -100, times: 3 },
        inCanvas("[data-testid='inspect-tolerance-card']"),
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRun:horizontal"],
    },
    "inspect-c8-outer": {
      profile: "image-inspect",
      how: "Mock C8: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image, press 1, turn Outer on in the bar (it needs a ruler) and rest the pointer on the image again: the length pill adds the “Outer” sub-label.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "1" },
        inspectButton("Outer"),
        hoverCanvas,
        hudShown,
        runShown,
        inCanvas("[data-testid='inspect-ruler-length'][data-outer='true']"),
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectRun:horizontal"],
    },
    "inspect-c9-pinned": {
      profile: "image-inspect",
      how: "Mock C9: with the flag forced on, open “Measure page”, press Inspect, press 1 and click twice at two heights, press 2 and click once more, then press Escape, pick Select and click the first measurement: three pinned measurements, the selected one with an accent label and round end handles.",
      steps: [
        open(ASSETS.pinsShot),
        inspectToggle,
        hoverAt(0.45, 0.35),
        hudShown,
        { press: "1" },
        runShown,
        clickAt(0.45, 0.35),
        hoverAt(0.55, 0.5),
        runShown,
        clickAt(0.55, 0.5),
        { press: "2" },
        hoverAt(0.5, 0.65),
        runShown,
        clickAt(0.5, 0.65),
        { press: "Escape" },
        tool("Select"),
        // Back on the first measurement's line (where it was pinned); its <g> root is not clickable.
        clickAt(0.45, 0.35),
        // The measure root carries data-selected; parts search below an area, so look from the canvas.
        {
          waitFor: {
            area: "editorImage.canvas",
            part: { css: "[data-kind='measure'][data-selected='true']" },
          },
        },
      ],
      demonstrates: ["editorImage.measure:selected"],
    },
    "inspect-c10-empty": {
      profile: "image-toolbar",
      how: "Mock C10: with the three image-editor flags forced on, open “Settings page”, press Inspect, zoom out and rest the pointer on the empty canvas beside the image: the loupe is hatched with “No pixels here” and the chip says “Nothing to read”.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        zoomOut,
        hoverAt(0.05, 0.5),
        { waitFor: { area: "editorImage.inspectEmpty" } },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectEmpty:shown"],
    },
    "inspect-c11-legend": {
      profile: "image-inspect",
      how: "Mock C11: with the flag forced on, open “Settings page”, press Inspect, rest the pointer on the image and press ?: the mode pill opens into the key legend, with a button that hides it.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        hoverCanvas,
        hudShown,
        { press: "?" },
        {
          waitFor: {
            area: "editorImage.inspectMode",
            part: { role: "button", name: "Hide the keys", exact: true },
          },
        },
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectMode:legend"],
    },
    "inspect-c12-edge": {
      profile: "image-toolbar",
      how: "Mock C12: with the three image-editor flags forced on, open “Settings page”, press Inspect, zoom in three steps and rest the pointer near the bottom-right corner of the canvas: the loupe and chip flip to the left and above the pointer, with the chip above the loupe.",
      steps: [
        open(ASSETS.settingsShot),
        inspectToggle,
        zoomIn,
        zoomIn,
        zoomIn,
        hoverAt(0.97, 0.95),
        hudShown,
        inCanvas("[data-ui-area='editorImage.inspectHud'][data-flip-x='true'][data-flip-y='true']"),
      ],
      keepPointer: true,
      demonstrates: ["editorImage.inspectHud:reading"],
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
    "reopen-editable": {
      profile: "image-canvas",
      how: "With the flag forced on, open “Settings page”, pick Step, click the canvas, press Save and answer Overwrite; leave the editor and open “Settings page” again: a pill at the top of the stage says it reopened with everything editable, with the time it was saved, and fades after about four seconds.",
      steps: [
        open(ASSETS.settingsShot),
        tool("Step"),
        { click: { area: "editorImage.canvas" } },
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
        { navigate: "/library" },
        open(ASSETS.settingsShot),
        { waitFor: { area: "editorImage.reopenNotice" } },
      ],
      demonstrates: ["editorImage.reopenNotice:editable"],
      gates: [{ flag: "image-canvas", side: "on" }],
    },
    "reopen-flat": {
      profile: "image-canvas-unreadable",
      how: "With the flag forced on and a corrupt editable document beside “Settings page”, open it: the flat image opens, with a pill that says the earlier drawings are part of it now and can no longer be moved, and stays until dismissed.",
      steps: [open(ASSETS.settingsShot), { waitFor: { area: "editorImage.reopenNotice" } }],
      demonstrates: ["editorImage.reopenNotice:flat"],
      gates: [{ flag: "image-canvas", side: "on" }],
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
      "editorImage.textStatus:pending": nc(
        "transient",
        "recognition settles in well under a second on a drawing, and the catalog cannot slow the helper; the panel reads “Recognizing text…” until then",
      ),
      "editorImage.textStatus:unavailable": nc(
        "inducedFailure",
        "showing it needs a run without the recognition helper; the catalog could only get that with a test-only override of the helper path in production code (or by deleting the helper on the runner), and the real-app proof `verify/image-text.verify.ts` covers it by renaming the helper away",
      ),
      "editorImage.inspectColors:counting": nc(
        "transient",
        "the count of a catalog-sized image ends in well under a second, before a screenshot can be taken",
      ),
      "editorImage.inspectColors:error": nc(
        "inducedFailure",
        "shown only when the image cannot be decoded or the colors worker fails; the page tests pin it",
      ),
    },
  },
);
