import {
  ArrowUpRight,
  Crop,
  Droplet,
  MousePointer2,
  PenLine,
  Square,
  TextSelect,
  Type,
} from "lucide-react";
import type { AnnotationTool } from "../annotations/tools";
import { RedactIcon, StepIcon, type ToolIcon } from "./editor-icons";

/** i18n keys (`screenshots` namespace) of the tools' plain labels. */
export type ToolLabelKey =
  | "toolSelect"
  | "toolPen"
  | "toolBox"
  | "toolArrow"
  | "toolText"
  | "toolStep"
  | "toolBlur"
  | "toolRedact"
  | "toolCrop"
  | "toolExportFrame"
  | "toolSelectText";

/**
 * The key that picks each tool (mock B2). C, I, 1 and 2 are Inspect's; "Select text" has none.
 * Shown in the tooltip's kbd chip and set as `aria-keyshortcuts`.
 */
export const TOOL_KEYS: Partial<Record<AnnotationTool, string>> = {
  select: "V",
  pen: "P",
  box: "R",
  arrow: "A",
  text: "T",
  step: "N",
  blur: "B",
  crop: "X",
};

/** The key that opens the Add image menu (canvas mode only). */
export const ADD_IMAGE_KEY = "M";

/** The five tools the compact toolbar folds into its Draw menu, in menu order. */
export const DRAW_TOOLS = ["pen", "box", "arrow", "text", "step"] as const;

/**
 * Label and icon of a tool. In canvas mode (`image-canvas`) the blur tool is the destructive
 * "Redact" and the crop tool frames the export; with the flag off they are still today's
 * gaussian blur (partly reversible, so not a redaction) and a real image crop, and keep their
 * old names.
 */
export function toolMeta(
  tool: AnnotationTool,
  canvasMode: boolean,
): { labelKey: ToolLabelKey; Icon: ToolIcon } {
  switch (tool) {
    case "select":
      return { labelKey: "toolSelect", Icon: MousePointer2 };
    case "pen":
      return { labelKey: "toolPen", Icon: PenLine };
    case "box":
      return { labelKey: "toolBox", Icon: Square };
    case "arrow":
      return { labelKey: "toolArrow", Icon: ArrowUpRight };
    case "text":
      return { labelKey: "toolText", Icon: Type };
    case "step":
      return { labelKey: "toolStep", Icon: StepIcon };
    case "blur":
      return canvasMode
        ? { labelKey: "toolRedact", Icon: RedactIcon }
        : { labelKey: "toolBlur", Icon: Droplet };
    case "crop":
      return { labelKey: canvasMode ? "toolExportFrame" : "toolCrop", Icon: Crop };
    case "selectText":
      return { labelKey: "toolSelectText", Icon: TextSelect };
  }
}
