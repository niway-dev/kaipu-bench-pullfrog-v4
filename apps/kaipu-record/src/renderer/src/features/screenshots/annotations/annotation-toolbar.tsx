import React from "react";
import { useTranslations } from "@kaipu/i18n";
import type { AnnotationTool } from "./tools";
import type { AnnotationToolsController } from "./use-annotation-tools";
import { DrawMenu } from "../toolbar/draw-menu";
import { ToolButton } from "../toolbar/tip";
import { TOOL_KEYS, toolMeta } from "../toolbar/tool-meta";
import styles from "./annotation-toolbar.module.css";
import { uiArea } from "@renderer/lib/ui-area";

/**
 * The tool group of the editor's toolbar (mock B1), left to right:
 *
 *   Select Pen Box Arrow Text Step | Redact | Export frame, Add image, Select text
 *
 * Each tool has a tooltip (label and key) and `aria-keyshortcuts`. Add image is a slot, filled
 * by the page in canvas mode, so the menu it opens stays where it was. Select text appears after
 * it when `image-text` is on.
 *
 * In `compact` (mock B3) Pen, Box, Arrow, Text and Step fold into one Draw menu and the tools
 * after Redact leave for the "•••" menu, which the page renders. The per-tool controls (colour,
 * stroke, size) live in the floating `AnnotationOptions` panel over the canvas, so the top bar
 * stays compact.
 */
export function AnnotationToolbar({
  tools,
  onPick,
  textTool = false,
  canvasMode = false,
  compact = false,
  idle = false,
  addImage,
}: {
  tools: AnnotationToolsController;
  /** Shows the "Select text" tool after the others (`image-text`). */
  textTool?: boolean;
  /** `image-canvas`: the blur tool is "Redact" and the crop tool is "Export frame". */
  canvasMode?: boolean;
  /** The page is narrower than 1000 px (mock B3). */
  compact?: boolean;
  /** Inspect is on: no tool reads as active (the tools stay one click away). */
  idle?: boolean;
  /** The Add image control, placed after Export frame; the page passes it in canvas mode. */
  addImage?: React.ReactNode;
  /** Fired when the user manually picks a tool — used to deselect the current shape
   *  so the freshly-picked tool starts clean (auto-select otherwise leaves one selected). */
  onPick?: () => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const pick = (tool: AnnotationTool): void => {
    tools.setTool(tool);
    onPick?.();
  };
  const button = (tool: AnnotationTool, size: number): React.JSX.Element => {
    const { labelKey, Icon } = toolMeta(tool, canvasMode);
    return (
      <ToolButton
        key={tool}
        label={t(labelKey)}
        {...(TOOL_KEYS[tool] ? { keyHint: TOOL_KEYS[tool] } : {})}
        className={`${styles.tool} ${tools.tool === tool && !idle ? styles.toolActive : ""}`}
        onClick={() => pick(tool)}
      >
        <Icon size={size} />
      </ToolButton>
    );
  };
  const divider = (key: string): React.JSX.Element => (
    <span key={key} className={styles.divider} aria-hidden />
  );

  return (
    <div {...uiArea("editorImage.tools")} className={styles.toolGroup} data-compact={compact}>
      {compact ? (
        <>
          {button("select", 17)}
          <DrawMenu tool={tools.tool} idle={idle} canvasMode={canvasMode} onPick={pick} />
          {button("blur", 17)}
        </>
      ) : (
        <>
          {(["select", "pen", "box", "arrow", "text", "step"] as const).map((tool) =>
            button(tool, 19),
          )}
          {divider("d1")}
          {button("blur", 19)}
          {divider("d2")}
          {button("crop", 19)}
          {addImage}
          {textTool && button("selectText", 19)}
        </>
      )}
    </div>
  );
}
