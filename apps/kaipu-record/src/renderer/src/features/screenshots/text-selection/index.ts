export {
  nearestWord,
  redactionRectsInPixels,
  wordBoxNorm,
  wordRange,
  type NormPoint,
  type PixelRect,
  type PixelSize,
} from "./geometry";
export { distinctLineCount, lineBoxesNorm, type LineBox } from "./lines";
export { useRecognizedText, type RecognizedText } from "./use-recognized-text";
export {
  useTextSelection,
  useTextSelectionKeys,
  type TextLayerModel,
  type TextToolStatus,
  type TextSelection,
} from "./use-text-selection";
export { TextNotice, TextShimmer, useTextNoticeState } from "./text-notice";
