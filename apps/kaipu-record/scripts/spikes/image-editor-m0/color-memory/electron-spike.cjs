// NIW2-697 M0 spike: color readout accuracy, capture round-trip, pixel-buffer memory.
// Runs in the Electron main process. Never run it on the M5: use run-on-macmini.sh.
//
// Env: SPIKE_FIXTURES (dir with generated fixtures), SPIKE_OUT (results dir),
//      SPIKE_TOOL (fixtures-tool binary, for CoreGraphics raw bytes), SPIKE_REPS (default 3).
const { app, BrowserWindow, screen } = require("electron");
const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { p3ToSrgb } = require("./colormath.cjs");

const FIXTURES = process.env.SPIKE_FIXTURES;
const OUT = process.env.SPIKE_OUT || path.join(__dirname, "out");
const TOOL = process.env.SPIKE_TOOL;
const REPS = Number(process.env.SPIKE_REPS || 3);
const MODES = ["srgb", "p3", "none"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error("[spike]", ...a);
const MiB = 1024 * 1024;

app.setPath("userData", path.join(OUT, "userdata"));
app.commandLine.appendSwitch("js-flags", "--expose-gc");

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 60000 });
  } catch (e) {
    return `ERROR ${e.message}`;
  }
}
function runAsync(cmd, args) {
  return new Promise((resolve) =>
    execFile(cmd, args, { encoding: "utf8", timeout: 60000 }, (error, stdout, stderr) =>
      resolve({
        code: error ? (error.code ?? 1) : 0,
        stdout,
        stderr,
        error: error && error.message,
      }),
    ),
  );
}
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (n) => (n == null ? n : Math.round(n * 100) / 100);

async function makeWindow(opts = {}) {
  const win = new BrowserWindow({
    width: 360,
    height: 120,
    x: 40,
    y: 700,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    ...opts,
  });
  await win.loadFile(path.join(__dirname, "decode.html"));
  win.showInactive();
  const hasGc = await win.webContents.executeJavaScript("__spike.hasGc()");
  if (!hasGc) throw new Error("gc() not exposed in the renderer");
  return win;
}

// ---------- color helpers ----------
function compare(items) {
  // items: [{name, expected:[r,g,b], got:[r,g,b], oog?}]
  const maxErr = [0, 0, 0];
  let worst = null;
  for (const it of items) {
    const err = it.expected.map((e, i) => Math.abs(e - it.got[i]));
    err.forEach((e, i) => (maxErr[i] = Math.max(maxErr[i], e)));
    const m = Math.max(...err);
    if (!worst || m > worst.maxChannelErr) {
      worst = { name: it.name, expected: it.expected, got: it.got, maxChannelErr: m };
    }
  }
  return { n: items.length, maxErr, worst };
}

function rawFromTool(png, samples, tag) {
  if (!TOOL) return null;
  const sj = path.join(OUT, `samples-${tag}.json`);
  const oj = path.join(OUT, `raw-${tag}.json`);
  fs.writeFileSync(sj, JSON.stringify(samples.map((s) => ({ x: s.x, y: s.y }))));
  const res = run(TOOL, ["raw", png, sj, oj]);
  if (res.startsWith("ERROR")) return { error: res };
  return JSON.parse(fs.readFileSync(oj, "utf8"));
}

// swatches: [{name, x, y, expected, oog}]
async function evaluate(win, png, swatches, rawTag) {
  const samples = swatches.map((s) => ({ x: s.x, y: s.y }));
  const raw = rawFromTool(png, samples, rawTag);
  const out = {
    cgRaw:
      raw && !raw.error ? { size: [raw.width, raw.height], colorSpace: raw.colorSpaceName } : raw,
    modes: {},
  };
  for (const mode of MODES) {
    const res = await win.webContents.executeJavaScript(
      `__spike.decodeSamples(${JSON.stringify(png)}, ${JSON.stringify(samples)}, ${JSON.stringify(mode)})`,
    );
    const items = swatches.map((s, i) => ({
      name: s.name,
      expected: s.expected,
      got: res.readout[i].rgb,
      oog: s.oog,
    }));
    const m = {
      size: [res.width, res.height],
      imageDataColorSpace: res.imageDataColorSpace,
      canvasColorSpaceHonored: res.canvasColorSpaceHonored,
      bitmapMs: res.bitmapMs,
      drawReadMs: res.drawReadMs,
      inGamut: compare(items.filter((i) => !i.oog)),
      perSwatch: items.map((i) => ({
        name: i.name,
        expected: i.expected,
        got: i.got,
        oog: !!i.oog,
      })),
    };
    const oog = items.filter((i) => i.oog);
    if (oog.length) m.outOfGamut = compare(oog);
    if (mode === "none" && raw && !raw.error) {
      m.vsCoreGraphicsRaw = compare(
        swatches.map((s, i) => ({
          name: s.name,
          expected: raw.samples[i],
          got: res.readout[i].rgb,
        })),
      );
    }
    out.modes[mode] = m;
  }
  return out;
}

function readFixture(name) {
  const json = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));
  return { png: path.join(FIXTURES, json.file), json };
}

function swatchesOf(json) {
  return json.swatches.map((s) => {
    if (s.srgb) return { name: s.name, x: s.x, y: s.y, expected: s.srgb, oog: false };
    const ref = p3ToSrgb(s.p3);
    return {
      name: s.name,
      x: s.x,
      y: s.y,
      expected: ref.rgb,
      oog: ref.oog || !!s.outOfSrgbGamut,
      p3: s.p3,
    };
  });
}

// ---------- phases ----------
async function phaseFixtures(win) {
  const res = {};
  for (const name of ["srgb-swatches", "p3-swatches", "monitor-profile-swatches"]) {
    log("fixture", name);
    const { png, json } = readFixture(name);
    const profile = run("/usr/bin/sips", ["-g", "profile", png]).split("profile:")[1]?.trim();
    res[name] = { embeddedProfile: profile, ...(await evaluate(win, png, swatchesOf(json), name)) };
  }
  return res;
}

const CELL = 64;
async function phaseCapture(win) {
  const srgb = readFixture("srgb-swatches").json.swatches;
  const p3 = readFixture("p3-swatches").json.swatches;
  const cells = [
    ...srgb.map((s) => ({ name: s.name, css: s.hex, expected: s.srgb, oog: false })),
    ...p3.map((s) => {
      const ref = p3ToSrgb(s.p3);
      const css = `color(display-p3 ${s.p3.map((v) => +(v / 255).toFixed(6)).join(" ")})`;
      return { name: s.name, css, expected: ref.rgb, oog: ref.oog || !!s.outOfSrgbGamut };
    }),
  ];
  const cols = 8;
  const rows = Math.ceil(cells.length / cols);
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#202020;overflow:hidden">
<div style="display:grid;grid-template-columns:repeat(${cols},${CELL}px);grid-auto-rows:${CELL}px">
${cells.map((c) => `<div style="background:${c.css}"></div>`).join("\n")}</div>`;
  const htmlPath = path.join(OUT, "capture.html");
  fs.writeFileSync(htmlPath, html);

  const cw = new BrowserWindow({
    x: 80,
    y: 80,
    width: cols * CELL,
    height: rows * CELL,
    useContentSize: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#202020",
    webPreferences: { backgroundThrottling: false },
  });
  await cw.loadFile(htmlPath);
  cw.show();
  cw.setAlwaysOnTop(true, "screen-saver");
  cw.moveTop();
  await sleep(2500);
  const b = cw.getContentBounds();
  const display = screen.getDisplayMatching(b);
  const file = path.join(OUT, "capture.png");
  fs.rmSync(file, { force: true });
  const cap = await runAsync("/usr/sbin/screencapture", [
    "-x",
    "-R",
    `${b.x},${b.y},${b.width},${b.height}`,
    file,
  ]);
  cw.close();
  const result = {
    contentBounds: b,
    scaleFactor: display.scaleFactor,
    display: {
      id: display.id,
      bounds: display.bounds,
      colorSpace: display.colorSpace,
      depth: display.colorDepth,
    },
    screencapture: { code: cap.code, stderr: cap.stderr.trim(), error: cap.error },
    cells: cells.length,
  };
  if (!fs.existsSync(file)) {
    result.error = "screencapture produced no file";
    return result;
  }
  const sipsOut = run("/usr/bin/sips", [
    "-g",
    "profile",
    "-g",
    "pixelWidth",
    "-g",
    "pixelHeight",
    "-g",
    "dpiWidth",
    file,
  ]);
  const grab = (k) => sipsOut.split(`${k}:`)[1]?.split("\n")[0].trim();
  result.embeddedProfile = grab("profile");
  result.pixelSize = [Number(grab("pixelWidth")), Number(grab("pixelHeight"))];
  result.dpi = grab("dpiWidth");
  const rx = result.pixelSize[0] / b.width;
  const ry = result.pixelSize[1] / b.height;
  result.pixelRatio = [rx, ry];
  const swatches = cells.map((c, i) => ({
    name: `${c.name} ${c.css}`,
    x: Math.round(((i % cols) * CELL + CELL / 2) * rx),
    y: Math.round((Math.floor(i / cols) * CELL + CELL / 2) * ry),
    expected: c.expected,
    oog: c.oog,
  }));
  const ev = await evaluate(win, file, swatches, "capture");
  // The three modes again, split by what the swatch is: CSS #hex (sRGB) vs color(display-p3 ...).
  result.cgRaw = ev.cgRaw;
  result.modes = {};
  for (const mode of MODES) {
    const m = ev.modes[mode];
    const ps = m.perSwatch;
    const hexItems = ps.slice(0, srgb.length);
    const p3Items = ps.slice(srgb.length);
    result.modes[mode] = {
      imageDataColorSpace: m.imageDataColorSpace,
      cssHexSwatches: compare(hexItems),
      cssP3InGamut: compare(p3Items.filter((i) => !i.oog)),
      cssP3OutOfGamut: compare(p3Items.filter((i) => i.oog)),
      vsCoreGraphicsRaw: m.vsCoreGraphicsRaw,
      perSwatch: ps,
    };
  }
  return result;
}

async function snapshot(win) {
  const pid = win.webContents.getOSProcessId();
  const metrics = app.getAppMetrics();
  const gpu = metrics.find((m) => m.type === "GPU");
  const fp = (p) => {
    if (!p) return null;
    const t = run("/usr/bin/footprint", ["-p", String(p), "-f", "bytes", "--noCategories"]);
    const m = t.match(/Footprint:\s*([\d,.]+)\s*(\w+)/);
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ""));
    const unit = { bytes: 1, B: 1, KB: 1024, MB: MiB, GB: 1024 * MiB }[m[2]] || 1;
    return (n * unit) / MiB;
  };
  const renderer = metrics.find((m) => m.pid === pid);
  const info = await win.webContents.executeJavaScript("__spike.mem.info()");
  return {
    rendererWS: renderer ? renderer.memory.workingSetSize / 1024 : null,
    gpuWS: gpu ? gpu.memory.workingSetSize / 1024 : null,
    totalWS: metrics.reduce((a, m) => a + m.memory.workingSetSize / 1024, 0),
    rendererFootprint: fp(pid),
    gpuFootprint: fp(gpu && gpu.pid),
    rendererPrivate: info.procPrivateKB != null ? info.procPrivateKB / 1024 : null,
    jsHeapUsed: info.usedJSHeapSize != null ? info.usedJSHeapSize / MiB : null,
    jsHeapTotal: info.totalJSHeapSize != null ? info.totalJSHeapSize / MiB : null,
    _pids: { renderer: pid, gpu: gpu && gpu.pid },
  };
}

// variant "gpu" = default canvas, "cpu" = willReadFrequently canvas.
async function phaseMemory(variant) {
  const png = path.join(FIXTURES, "6k.png");
  const W = 6144;
  const H = 3456;
  const theoretical = W * H * 4;
  const reps = [];
  for (let rep = 0; rep < REPS; rep++) {
    log("memory", variant, "rep", rep + 1);
    const win = await makeWindow();
    await sleep(1500);
    const stages = {};
    const timings = {};
    const take = async (name, step) => {
      if (step) timings[name] = await win.webContents.executeJavaScript(step);
      await sleep(600);
      stages[name] = await snapshot(win);
    };
    await take("baseline");
    await take("blob", `__spike.mem.loadBlob(${JSON.stringify(png)})`);
    await take("bitmap", "__spike.mem.bitmap()");
    await take("canvasDrawn", `__spike.mem.draw(${variant === "cpu"})`);
    await take("imageData", "__spike.mem.getData()");
    await take("standaloneCopy", "__spike.mem.copyAndRelease()");
    await take("released", "__spike.mem.dropAll()");
    await sleep(5000);
    await take("released+5s");
    const peak = app.getAppMetrics().find((m) => m.pid === win.webContents.getOSProcessId());
    win.close();
    await sleep(1500);
    reps.push({
      stages,
      timings,
      rendererPeakWS: peak ? peak.memory.peakWorkingSetSize / 1024 : null,
    });
  }
  // Deltas vs each rep's own baseline, median across reps, in MiB.
  const metricNames = [
    "rendererWS",
    "rendererFootprint",
    "rendererPrivate",
    "gpuWS",
    "gpuFootprint",
    "totalWS",
    "jsHeapUsed",
  ];
  const stageNames = Object.keys(reps[0].stages);
  const medianDeltaMiB = {};
  for (const s of stageNames) {
    medianDeltaMiB[s] = {};
    for (const mn of metricNames) {
      medianDeltaMiB[s][mn] = r2(
        median(reps.map((r) => (r.stages[s][mn] ?? NaN) - (r.stages.baseline[mn] ?? NaN))),
      );
    }
  }
  return {
    image: {
      width: W,
      height: H,
      theoreticalBytes: theoretical,
      theoreticalMiB: theoretical / MiB,
      pngBytes: fs.statSync(png).size,
    },
    variant,
    reps: REPS,
    metricsNote:
      "rendererWS/gpuWS/totalWS = app.getAppMetrics() workingSetSize (resident, MiB); rendererFootprint/gpuFootprint = macOS `footprint -p` dirty footprint; rendererPrivate = process.getProcessMemoryInfo().private; jsHeapUsed = performance.memory.usedJSHeapSize.",
    baselineMiB: Object.fromEntries(
      metricNames.map((mn) => [mn, r2(median(reps.map((r) => r.stages.baseline[mn])))]),
    ),
    medianDeltaMiB,
    decodeMs: {
      createImageBitmap: reps.map((r) => r.timings.bitmap.ms),
      drawImage: reps.map((r) => r.timings.canvasDrawn.ms),
      getImageData: reps.map((r) => r.timings.imageData.ms),
      totalPerRep: reps.map((r) =>
        r2(r.timings.bitmap.ms + r.timings.canvasDrawn.ms + r.timings.imageData.ms),
      ),
      medianTotal: r2(
        median(
          reps.map((r) => r.timings.bitmap.ms + r.timings.canvasDrawn.ms + r.timings.imageData.ms),
        ),
      ),
    },
    rendererPeakWS_MiB: reps.map((r) => r2(r.rendererPeakWS)),
    perRep: reps.map((r) => ({
      stages: Object.fromEntries(
        Object.entries(r.stages).map(([k, v]) => [
          k,
          Object.fromEntries(
            Object.entries(v).map(([a, b]) => [a, typeof b === "number" ? r2(b) : b]),
          ),
        ]),
      ),
    })),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const hostname = (
    run("/usr/sbin/scutil", ["--get", "LocalHostName"]).trim() || os.hostname()
  ).replace(/[^\w.-]/g, "_");
  const result = {
    host: hostname,
    startedAt: new Date().toISOString(),
    machine: {
      model: run("/usr/sbin/sysctl", ["-n", "hw.model"]).trim(),
      cpu: run("/usr/sbin/sysctl", ["-n", "machdep.cpu.brand_string"]).trim(),
      macOS: run("/usr/bin/sw_vers", ["-productVersion"]).trim(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      displays: screen.getAllDisplays().map((d) => ({
        id: d.id,
        bounds: d.bounds,
        scaleFactor: d.scaleFactor,
        colorSpace: d.colorSpace,
        colorDepth: d.colorDepth,
        internal: d.internal,
      })),
      systemProfilerDisplays: run("/usr/sbin/system_profiler", ["SPDisplaysDataType"]),
    },
    errors: {},
  };
  const win = await makeWindow();
  for (const [name, fn] of [
    ["fixtures", () => phaseFixtures(win)],
    ["capture", () => phaseCapture(win)],
  ]) {
    try {
      result[name] = await fn();
    } catch (e) {
      result.errors[name] = String(e && e.stack ? e.stack : e);
      log(name, "failed", e);
    }
  }
  win.close();
  await sleep(500);
  try {
    result.memory = {
      gpuCanvas: await phaseMemory("gpu"),
      willReadFrequentlyCanvas: await phaseMemory("cpu"),
    };
  } catch (e) {
    result.errors.memory = String(e && e.stack ? e.stack : e);
    log("memory failed", e);
  }
  result.finishedAt = new Date().toISOString();
  const file = path.join(OUT, `results-${hostname}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  log("wrote", file);
}

app.whenReady().then(async () => {
  const timer = setTimeout(
    () => {
      log("global timeout, quitting");
      app.exit(2);
    },
    8 * 60 * 1000,
  );
  try {
    await main();
    clearTimeout(timer);
    app.quit();
  } catch (e) {
    console.error("[spike] fatal", e);
    clearTimeout(timer);
    app.exit(1);
  }
});
app.on("window-all-closed", () => {});
