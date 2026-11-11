export {
  blockRedactionRect,
  nearestBlock,
  nearestWord,
  textBlocks,
  redactionRectsInPixels,
  wordBoxNorm,
  wordRange,
  type NormPoint,
  type PixelRect,
  type PixelSize,
  type TextBlock,
} from "./geometry";
export { useRecognizedText, type RecognizedText } from "./use-recognized-text";
export {
  useTextSelection,
  useTextSelectionKeys,
  type TextLayerModel,
  type TextToolStatus,
  type TextSelection,
} from "./use-text-selection";
