import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kaipu Black editor layout (NIW2-619): the exact lane heights, the gap between lanes,
 * the rail width and where the picture sits. jsdom has no layout engine, so these read
 * the real stylesheets; the harness screenshots are the visual proof.
 */
const dir = path.dirname(new URL(import.meta.url).pathname);
const css = (file: string): string => readFileSync(path.join(dir, file), "utf8");

/** Declarations of one top-level rule, comments stripped (they quote old values). */
function rule(source: string, selector: string): string {
  const match = source.match(new RegExp(`(?:^|\\n)\\${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1]!.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("timeline lanes (15% lower than NIW2-611)", () => {
  it.each([
    ["zoom-lane.module.css", ".lane", "26px"],
    ["privacy-lane.module.css", ".lane", "20px"],
    ["audio-lane.module.css", ".lane", "29px"],
    ["timeline-strip.module.css", ".track", "46px"],
  ])("%s %s is %s tall", (file, selector, height) => {
    expect(rule(css(file), selector)).toMatch(new RegExp(`(?:^|[\\s;])height:\\s*${height};`));
  });

  it("leaves 3px between lanes", () => {
    expect(rule(css("timeline-strip.module.css"), ".timelineBody")).toMatch(/row-gap:\s*3px;/);
  });
});

describe("tool rail and picture", () => {
  it("the rail is 44px wide", () => {
    expect(rule(css("editor-toolbar.module.css"), ".rail")).toMatch(/(?:^|\s)width:\s*44px;/);
  });

  it("the tool flyout uses the panel surface, a strong 1px line, a 6px radius and the popover shadow", () => {
    const flyout = rule(css("editor-toolbar.module.css"), ".flyout");
    expect(flyout).toMatch(/background:\s*var\(--bg-panel\)/);
    expect(flyout).toMatch(/border:\s*1px solid var\(--line-strong\)/);
    expect(flyout).toMatch(/border-radius:\s*6px/);
    expect(flyout).toMatch(/box-shadow:\s*var\(--shadow-popover\)/);
  });

  it("the current flyout option takes the accent colour", () => {
    expect(rule(css("editor-toolbar.module.css"), ".flyoutCurrent")).toMatch(
      /color:\s*var\(--accent-primary\)/,
    );
  });

  it("nothing paints a hover fill in a corner of a rail button", () => {
    const toolbar = css("editor-toolbar.module.css");
    expect(toolbar).not.toMatch(/variantSwitch/);
  });

  it("the picture is centred with a 12px margin", () => {
    const region = rule(
      css("../../../pages/video-editor/video-editor-page.module.css"),
      ".videoRegion",
    );
    expect(region).toMatch(/justify-items:\s*center;/);
    expect(region).toMatch(/padding:\s*12px;/);
  });
});

describe("timeline zoom layout (NIW2-667)", () => {
  const strip = css("timeline-strip.module.css");
  /** The formatter wraps long declarations: compare them with their whitespace collapsed. */
  const flat = (declarations: string): string => declarations.replace(/\s+/g, " ");
  const body = flat(rule(strip, ".timelineBody"));

  it("scrolls horizontally in one container and sizes the lanes column by --zoom", () => {
    expect(body).toMatch(/overflow-x:\s*auto;/);
    expect(body).toMatch(
      /grid-template-columns: var\(--lane-label-col\) calc\( ?\(100% - var\(--lane-label-col\) - var\(--lane-inset\)\) \* var\(--zoom, 1\) ?\);/,
    );
  });

  it("the playhead layer is as wide as the lanes column, so it cannot drift from the ruler", () => {
    // The grid's `100%` is the content box (clientWidth minus the right padding, which is
    // one inset); the layer's is the padding box (clientWidth). Taking the extra inset off
    // the layer's side makes both the same width at every zoom.
    expect(body).toMatch(/padding-right:\s*var\(--lane-inset\);/);
    const layer = flat(rule(strip, ".playheadLayer"));
    expect(layer).toMatch(
      /width:\s*calc\(\(100% - var\(--lane-label-col\) - 2 \* var\(--lane-inset\)\) \* var\(--zoom, 1\)\);/,
    );
    expect(layer).toMatch(/left:\s*calc\(var\(--lane-label-col\) \+ var\(--lane-inset\)\);/);
  });

  it("the labels stay put and cover their whole row, including the 3px between rows", () => {
    const label = flat(rule(strip, ".laneLabel"));
    expect(label).toMatch(/position:\s*sticky;/);
    expect(label).toMatch(/left:\s*0;/);
    expect(label).toMatch(/align-self:\s*stretch;/);
    expect(label).toMatch(/box-shadow:\s*0 3px 0 0 var\(--bg-panel\);/);
    expect(label).toMatch(/background:\s*var\(--bg-panel\);/);
  });

  it("leaves room for the edge handles that sit half outside their block", () => {
    expect(body).toMatch(/--lane-inset:\s*6px;/);
    expect(body).toMatch(/column-gap:\s*var\(--lane-inset\);/);
  });

  it("gives a fit timeline its old height: the scrollbar's strip is taken back by a negative margin", () => {
    expect(body).toMatch(/padding-bottom:\s*8px;/);
    expect(body).toMatch(/margin-bottom:\s*-8px;/);
  });
});
