// Renderer side of the NIW2-697 color/memory spike. Loaded with nodeIntegration (spike only).
// Main drives it with webContents.executeJavaScript('__spike.<fn>(...)').
const fs = require("fs");
const { p3ToSrgb } = require("./colormath.cjs");

const st = {};

function blobOf(path) {
  return new Blob([fs.readFileSync(path)], { type: "image/png" });
}

// Decodes `path` in one mode and returns the sampled sRGB readout (one conversion, at the end).
//   srgb: createImageBitmap(blob)                           -> srgb canvas     -> srgb getImageData
//   p3:   createImageBitmap(blob)                           -> display-p3 canvas -> p3 getImageData -> JS P3->sRGB
//   none: createImageBitmap(blob,{colorSpaceConversion:none}) -> srgb canvas     -> srgb getImageData
async function decodeSamples(path, samples, mode) {
  const blob = blobOf(path);
  const t0 = performance.now();
  const bmp =
    mode === "none"
      ? await createImageBitmap(blob, { colorSpaceConversion: "none" })
      : await createImageBitmap(blob);
  const t1 = performance.now();
  const space = mode === "p3" ? "display-p3" : "srgb";
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d", { colorSpace: space });
  const honored = ctx.getContextAttributes().colorSpace;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height, { colorSpace: space });
  const t2 = performance.now();
  const data = img.data;
  const readout = samples.map((s) => {
    const o = (s.y * bmp.width + s.x) * 4;
    const px = [data[o], data[o + 1], data[o + 2]];
    if (mode !== "p3") return { rgb: px, alpha: data[o + 3] };
    const c = p3ToSrgb(px);
    return { rgb: c.rgb, p3: px, oog: c.oog, alpha: data[o + 3] };
  });
  bmp.close();
  return {
    mode,
    width: img.width,
    height: img.height,
    imageDataColorSpace: img.colorSpace,
    canvasColorSpaceHonored: honored,
    bitmapMs: round(t1 - t0),
    drawReadMs: round(t2 - t1),
    readout,
  };
}

const round = (n) => Math.round(n * 100) / 100;

// ---- memory stages for one 6144x3456 decode ----
const mem = {
  loadBlob(path) {
    st.blob = blobOf(path);
    return { blobBytes: st.blob.size };
  },
  async bitmap() {
    const t = performance.now();
    st.bmp = await createImageBitmap(st.blob);
    return { ms: round(performance.now() - t), w: st.bmp.width, h: st.bmp.height };
  },
  // willReadFrequently asks Chromium for a CPU-backed canvas instead of a GPU one.
  draw(willReadFrequently) {
    const t = performance.now();
    st.canvas = document.createElement("canvas");
    st.canvas.width = st.bmp.width;
    st.canvas.height = st.bmp.height;
    st.ctx = st.canvas.getContext("2d", {
      colorSpace: "srgb",
      willReadFrequently: !!willReadFrequently,
    });
    st.ctx.drawImage(st.bmp, 0, 0);
    return { ms: round(performance.now() - t) };
  },
  getData() {
    const t = performance.now();
    st.img = st.ctx.getImageData(0, 0, st.canvas.width, st.canvas.height, { colorSpace: "srgb" });
    const d = st.img.data;
    // touch the buffer so lazily-committed pages are real
    let sum = 0;
    for (let i = 0; i < d.length; i += 4096) sum += d[i];
    return { ms: round(performance.now() - t), bytes: d.byteLength, sum };
  },
  async copyAndRelease() {
    st.copy = new Uint8ClampedArray(st.img.data);
    st.img = null;
    st.bmp.close();
    st.bmp = null;
    st.canvas.width = 0;
    st.canvas.height = 0;
    st.canvas = null;
    st.ctx = null;
    st.blob = null;
    await collect();
    return { bytes: st.copy.byteLength };
  },
  async dropAll() {
    st.copy = null;
    await collect();
    return {};
  },
  async info() {
    const m = performance.memory || {};
    const p = process.getProcessMemoryInfo ? await process.getProcessMemoryInfo() : {};
    return {
      usedJSHeapSize: m.usedJSHeapSize,
      totalJSHeapSize: m.totalJSHeapSize,
      procPrivateKB: p.private,
      procResidentKB: p.residentSet,
      procSharedKB: p.shared,
    };
  },
};

async function collect() {
  for (let i = 0; i < 3; i++) {
    if (typeof gc === "function") gc();
    await new Promise((r) => setTimeout(r, 50));
  }
}

window.__spike = { decodeSamples, mem, hasGc: () => typeof gc === "function" };
