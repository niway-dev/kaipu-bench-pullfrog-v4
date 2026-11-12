import React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "@kaipu/i18n";
import { uiArea } from "@renderer/lib/ui-area";
import type { AnnotationTool } from "../annotations/tools";
import { DRAW_TOOLS, TOOL_KEYS, toolMeta } from "./tool-meta";
import { ToolbarMenu } from "./toolbar-menu";
import parts from "./toolbar-parts.module.css";

const isDrawTool = (tool: AnnotationTool): tool is (typeof DRAW_TOOLS)[number] =>
  (DRAW_TOOLS as readonly AnnotationTool[]).includes(tool);

/**
 * The compact toolbar's "Draw" menu (mock B3): Pen, Box, Arrow, Text and Step folded into one
 * button. The button shows the active drawing tool's icon (Box when another tool is active) and
 * reads as an active tool while one of the five is picked.
 */
export function DrawMenu({
  tool,
  idle,
  canvasMode,
  onPick,
}: {
  tool: AnnotationTool;
  /** Inspect is on: no tool reads as active. */
  idle: boolean;
  canvasMode: boolean;
  onPick: (tool: AnnotationTool) => void;
}): React.JSX.Element {
  const t = useTranslations("screenshots");
  const shown = isDrawTool(tool) ? tool : "box";
  const { Icon } = toolMeta(shown, canvasMode);
  return (
    <ToolbarMenu
      area={uiArea("editorImage.drawMenu")}
      label={t("toolDraw")}
      menuLabel={t("drawMenuLabel")}
      buttonClassName={isDrawTool(tool) && !idle ? parts.menuButtonActive : undefined}
      items={DRAW_TOOLS.map((id) => {
        const meta = toolMeta(id, canvasMode);
        return {
          id,
          label: t(meta.labelKey),
          icon: <meta.Icon size={15} />,
          hint: TOOL_KEYS[id],
          active: id === tool && !idle,
          onSelect: () => onPick(id),
        };
      })}
    >
      <Icon size={17} />
      <ChevronDown size={11} aria-hidden />
    </ToolbarMenu>
  );
}
