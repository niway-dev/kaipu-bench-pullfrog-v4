---
title: Image editor — design brief for the canvas and Inspect screens
description: What a designer needs to draw every new screen and state of the image editor - the canvas, Inspect mode with loupe, color and ruler, the step counter, adding images, the colors panel, text selection and redaction. Written to be handed to Claude Design as is.
---

# Image editor — design brief for the canvas and Inspect screens

**Status: 🔵 Proposed · 2026-11-11.** This is a request for mocks, not a decision. The
behavior it describes is decided in the
[canvas and Inspect design](/specs/2026-11-11-image-editor-canvas-and-inspect-design/); the
look is what this brief asks for. The mocks are applied last, in
[NIW2-708](https://linear.app/niway/issue/NIW2-708/image-editor-m11-apply-the-owners-mocks-to-the-canvas-and-inspect-ui).

The brief is self-contained: it can be pasted into a design tool without the rest of the
repository.

## 1. What to design

Kaipu Record is a desktop app (macOS and Windows) that records the screen and takes
screenshots. After a screenshot, the user lands in an **image editor** to annotate it and
then copies or saves the result.

That editor is growing in two ways, and both need screens:

1. **It becomes an infinite canvas.** The screenshot sits in the middle of an endless
   surface. The user can write and draw outside the image and add more images. Copy and Save
   export only the box that contains the content, never the empty canvas.
2. **It gains an Inspect mode** for people who care about pixel-perfect work: a loupe, the
   color under the cursor, a ruler that measures with one key, and a panel that lists every
   color in the image.

Smaller additions ride along: a numbered step counter, selecting and copying the text inside
a screenshot, and a stronger tool to hide sensitive content.

The audience is designers and developers checking their own UI. The competitor they compare
us to is Shottr: light, fast, keyboard-first. The editor must feel as direct as that and
stay quiet: the screenshot is the subject, the chrome is not.

## 2. The editor today

Design on top of this; do not redraw it from zero.

**Window.** The editor is a page inside the app's main window, under a custom title bar
(logo, app name, workspace switcher). Default window 900×670, minimum 720×560. Most people
use it larger.

**Layout.** A column with two parts:

- A **top toolbar**, one row, with a 1 px bottom border.
- A **body**: the stage on the left filling the space, and a **Beautify panel** on the
  right, 280 px wide, with a left border.

**Above the toolbar.** A workspace chip ("IN · Work ▾") that shows and changes the
workspace the saved capture belongs to.

**Top toolbar, left to right.**

- Tools, icon only: Select, Pen, Box, Arrow, Text, Blur, Crop.
- The editable title of the capture.
- On the right, one group: Undo, Redo, a divider, then Copy, Save (the only filled accent
  button), PDF, and Discard when a saved version exists.

**Floating over the stage.**

- Top left: an options card for the active tool (color swatches, text size XS/S/M/L, three
  stroke widths, delete).
- Bottom left: a zoom pill with three parts: zoom out, the percentage (clicking it resets
  to 100%), and zoom in. Zoom runs from 50% to 300%.
- Bottom center: a "Saved" toast.

**Beautify panel.** Heading, background swatches (none, dark, carbon, magenta and others),
and three sliders: Padding 0–96 px, Corners 0–28 px, Shadow 0–100%.

**Visual language ("Kaipu Black").**

| Token          | Dark value                   |
| -------------- | ---------------------------- |
| App and stage  | `#060607`                    |
| Panel          | `#0b0b0d`                    |
| Card and input | `#0e0e10`                    |
| Hover          | `#17171a`                    |
| Separator      | white at 8%                  |
| Strong border  | white at 14%                 |
| Text primary   | `#e8e8ed`                    |
| Text secondary | `#c8c8d0`                    |
| Text muted     | `#a1a1aa`                    |
| Accent         | `#f6055c` (hover `#d4044f`)  |
| Radius         | 4, 5, 8 px                   |
| Spacing        | 4, 8, 12, 16, 24, 32 px      |
| Font           | Geist; numbers in Geist Mono |
| Font sizes     | 11, 12, 13, 14, 16, 20 px    |

Icons are Lucide, 19 px in the toolbar. There is a light theme (background `#fafafa`); the
dark theme is the main one.

## 3. Rules for every screen

- **Use the existing tokens, font and icon set.** No new color, typeface or icon family.
  If a new token is truly needed, name it and say why.
- **Anything drawn over the screenshot must read on any image**: white, black, busy,
  saturated. The loupe, the color chip, the ruler and its label, selection handles and step
  badges all sit on content we do not control.
- **Numbers are in Geist Mono** and sizes are always in image pixels, written `240 px`.
- **Keyboard first.** Every tool has a one-key shortcut, shown in its tooltip.
- **All copy in English.**
- **Dark theme for every screen.** Light theme for the three screens marked ☀ below.
- **Frame size.** Draw at 1440×900 and check that the layout survives 720×560.

## 4. Screens and states

Each state has an ID. Please keep the IDs on the frames: the app's UI catalog uses the same
names.

### A. Canvas

The stage is now an infinite surface that pans and zooms. The user needs to understand,
without reading anything, what is content and what is empty canvas.

| ID   | State                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 ☀ | One screenshot centered on the canvas, no background, nothing selected. This is what opens by default.                                                        |
| A2   | The same with a Beautify background and padding: the background and padding belong to the export and must look different from the empty canvas around them.   |
| A3   | Content outside the image: a text label and an arrow that start outside the screenshot and point into it.                                                     |
| A4   | Two images on the canvas with a gap between them, one of them selected (it can be moved).                                                                     |
| A5   | **Export frame** active. It replaces today's Crop tool: a rectangle the user draws to say "export exactly this". Handles, dimmed outside, its size in pixels. |
| A6   | Zoomed in and panned away from the content, with the way back: zoom control, "fit to content", and a hint when the content is off screen.                     |
| A7   | Empty canvas: every item was deleted.                                                                                                                         |

Design question for you: **how does the user see what Copy and Save will export?** The export
is the smallest box around all content, plus the padding. We need a quiet, always-there cue
(an outline, a tint, a size label) so that adding a note outside the image visibly grows the
export. Propose one; show it in A1 to A4.

### B. Toolbar

| ID  | State                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | The toolbar with the new tools in place: **Inspect**, **Step**, **Add image**. Crop is renamed Export frame; Blur is renamed Redact. Show where each lives and how the group is divided. |
| B2  | Tooltips with the shortcut key for each tool.                                                                                                                                            |
| B3  | The toolbar at the minimum window width (720 px): what collapses, and into what.                                                                                                         |

Today there are seven tools plus undo and redo; with the new ones there are ten. Propose the
grouping. Inspect is a mode, not a drawing tool, and may deserve a different treatment.

### C. Inspect mode

One mode, entered with a key or the toolbar. While it is on, the cursor reads the image
instead of drawing on it.

| ID   | State                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 ☀ | Hovering the image: a **loupe** following the cursor that shows the pixels enlarged and unsmoothed (a visible pixel grid, the center pixel marked), and a **color chip** with the color and its value, for example `#F6055C`. |
| C2   | The format switch: hex, rgb, hsl, oklch. And a second switch, "As captured", that shows the color as recorded by a wide-gamut display instead of converted to sRGB.                                                           |
| C3   | A color that sRGB cannot represent: the value carries a small marker and an explanation on hover.                                                                                                                             |
| C4   | The color was copied (key `C`): the confirmation.                                                                                                                                                                             |
| C5   | Key `1`: the **horizontal ruler**. A line runs left and right from the cursor until the color changes, with its length, for example `240 px`.                                                                                 |
| C6   | Key `2`: the **vertical ruler**, same idea.                                                                                                                                                                                   |
| C7   | Turning the mouse wheel changes the **tolerance** (how different a color must be to stop the line). Show the tolerance while it changes.                                                                                      |
| C8   | Holding `Shift`: the ruler shows the outer size instead of the inner one.                                                                                                                                                     |
| C9   | A click **pins** the measurement. Show three pinned measurements on one image, one of them selected with draggable end points. Pinned measurements are exported with the image.                                               |
| C10  | The cursor is over empty canvas or padding: nothing to read. Show how the loupe and chip behave.                                                                                                                              |
| C11  | The mode indicator and a compact legend of the keys (`1`, `2`, `C`, wheel, `Shift`, `Esc`), dismissible.                                                                                                                      |

The loupe, chip and ruler label must never cover what they are measuring, including near the
window edges. Show the loupe in a corner case (cursor at the bottom-right of the image).

### D. Step counter

A tool that drops numbered badges: 1, 2, 3, in order, to explain a flow.

| ID  | State                                                                |
| --- | -------------------------------------------------------------------- |
| D1  | Four badges on a screenshot, in the default color.                   |
| D2  | A badge selected, with the options card: color and size.             |
| D3  | Badges at the three sizes over a light and a dark area of the image. |

Deleting a badge renumbers the rest; nothing to draw for that beyond the result.

### E. Adding images

| ID  | State                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------- |
| E1  | The **Add image** button open: "New capture" and "From Library".                                                            |
| E2  | The Library picker: choosing an existing capture from Kaipu to place on the canvas.                                         |
| E3  | An image just added (by the button or by pasting with `Cmd+V`): where it lands and how it is shown as selected and movable. |

### F. Colors panel

A list of every color in the image, so a designer notices two whites that should be one, and
can find where each one is used.

| ID   | State                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 ☀ | The panel with the colors of a UI screenshot: a swatch, the value and the share of the image for each, largest first.                                                                   |
| F2   | **Near-identical colors grouped**: two whites (`#FFFFFF` and `#FDFDFD`) shown together and flagged as almost the same. This is the reason the panel exists; make it impossible to miss. |
| F3   | A color clicked: every place it appears is **highlighted on the image** and the rest is dimmed.                                                                                         |
| F4   | Computing (a large image takes a moment) and the case of a photograph with thousands of colors.                                                                                         |
| F5   | Copying a color from the list.                                                                                                                                                          |

Design question for you: **where does this panel live?** The right side holds Beautify today.
Tabs in that panel, a second panel, or a popover are all possible. Propose one that still
works at the minimum window size.

### G. Text in the screenshot

The app recognizes the text inside the image so it can be selected like text on a web page.

| ID  | State                                                                                       |
| --- | ------------------------------------------------------------------------------------------- |
| G1  | Text being recognized, right after opening (it takes about a second).                       |
| G2  | Hovering recognized text: the cursor and the cue that this text can be selected.            |
| G3  | A selection across two lines, and the copy confirmation.                                    |
| G4  | Text recognition unavailable on this machine: how the tool says so without an error dialog. |

### H. Redact

Today's Blur becomes Redact, a tool to hide content for good.

| ID  | State                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | The options card with two styles: **Strong blur** (default) and **Solid**. It must say, in one short line, that only Solid hides content for certain.                             |
| H2  | A region redacted with each style, side by side.                                                                                                                                  |
| H3  | With the tool active, each recognized text block is a target: hovering one outlines it, a click redacts exactly that block.                                                       |
| H4  | After saving, a redaction is permanent: the original pixels are gone. Show a saved redaction (it cannot be removed, only covered) and the one-time warning before the first save. |

### I. Saving and reopening

| ID  | State                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | A saved item reopened: everything is still editable. Nothing new to draw unless you want a cue.                                                      |
| I2  | The editable version could not be read, so the editor opened the flat image instead: a quiet notice that the old annotations can no longer be moved. |

## 5. What to deliver

1. One frame per state ID above, dark theme, 1440×900.
2. Light theme for A1, C1 and F1.
3. The minimum-window version (720×560) of A1, B3 and F1.
4. A component sheet: loupe, color chip, ruler line and label, pinned measurement, step badge
   at three sizes, export frame handles, colors panel row and grouped row, mode indicator.
5. Your answers to the two design questions (the export cue in A, the place of the colors
   panel in F) and to the toolbar grouping in B, each with the option you rejected and why.

## 6. Not part of this request

- The capture overlay (selecting the area of the screen). It does not change.
- The video editor.
- Dragging files into the canvas from outside the app.
- Exporting only a selection or a section of the canvas.
- Rulers in units other than pixels.
- Alignment and distribution helpers.
