/**
 * Colors worker (NIW2-704): counts and locates colors off the main thread, so a 5K
 * photograph never blocks the editor. It keeps its own copy of the pixels for as long as the
 * panel's analyzer lives; the main thread terminates it to release them. No DOM here.
 */
import { analyzeColors, locateMask, type ColorIndex } from "./histogram";
import type { ColorsRequest, ColorsResponse } from "./colors-messages";

type WorkerSelf = typeof self & {
  onmessage: ((event: MessageEvent<ColorsRequest>) => void) | null;
  postMessage(message: ColorsResponse, transfer?: Transferable[]): void;
};

const workerSelf = self as unknown as WorkerSelf;

let pixels: Uint8ClampedArray | null = null;
let size = { width: 0, height: 0 };
let index: ColorIndex | null = null;

const fail = (id: number, error: unknown): void =>
  workerSelf.postMessage({
    type: "error",
    id,
    message: error instanceof Error ? error.message : String(error),
  });

async function locate(id: number, request: Extract<ColorsRequest, { type: "locate" }>) {
  if (!pixels || !index) throw new Error("locate before analyze");
  const { mask, matched } = locateMask(pixels, index.groupOfBin, request.target);
  const { width, height } = size;
  try {
    const bitmap = await createImageBitmap(new ImageData(mask, width, height));
    workerSelf.postMessage({ type: "located", id, matched, width, height, bitmap }, [bitmap]);
  } catch {
    const buffer = mask.buffer;
    workerSelf.postMessage({ type: "located", id, matched, width, height, pixels: buffer }, [
      buffer,
    ]);
  }
}

workerSelf.onmessage = (event) => {
  const request = event.data;
  try {
    if (request.type === "analyze") {
      pixels = new Uint8ClampedArray(request.pixels);
      size = { width: request.width, height: request.height };
      index = analyzeColors(pixels, request.width, request.height);
      workerSelf.postMessage({ type: "analysis", id: request.id, analysis: index.analysis });
    } else {
      locate(request.id, request).catch((error: unknown) => fail(request.id, error));
    }
  } catch (error) {
    fail(request.id, error);
  }
};
