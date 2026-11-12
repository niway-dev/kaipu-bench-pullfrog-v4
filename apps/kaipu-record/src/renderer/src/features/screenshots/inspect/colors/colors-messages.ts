import type { AreaBounds, ColorAnalysis, LocateTarget } from "./histogram";

/** Main thread -> colors worker. `analyze` comes first and transfers the worker its copy. */
export type ColorsRequest =
  | { type: "analyze"; id: number; pixels: ArrayBuffer; width: number; height: number }
  | { type: "locate"; id: number; target: LocateTarget };

/** Colors worker -> main thread. A located overlay is an ImageBitmap when the worker can make
 * one (no copy on the main thread), otherwise the raw RGBA pixels. */
export type ColorsResponse =
  | { type: "progress"; id: number; done: number }
  | { type: "analysis"; id: number; analysis: ColorAnalysis }
  | {
      type: "located";
      id: number;
      matched: number;
      /** Connected regions of the match (see `regionsOf`) and the largest one's bounds. */
      areas: number;
      bounds: AreaBounds | null;
      width: number;
      height: number;
      bitmap?: ImageBitmap;
      pixels?: ArrayBuffer;
    }
  | { type: "error"; id: number; message: string };
