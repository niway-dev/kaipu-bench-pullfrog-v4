// Spawns Electron as a child of this node process, so that under launchd the TCC
// "responsible process" for screencapture is node (which has Screen Recording), not Electron.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = process.env.SPIKE_OUT || path.join(root, "out");
fs.mkdirSync(out, { recursive: true });
const electron = process.env.SPIKE_ELECTRON;
const child = spawn(electron, ["--js-flags=--expose-gc", path.join(root, "electron-spike.cjs")], {
  env: { ...process.env },
  stdio: ["ignore", fs.openSync(path.join(out, "stdout.json"), "w"), "inherit"],
});
const timer = setTimeout(
  () => {
    console.error("[launcher] timeout, SIGTERM");
    child.kill("SIGTERM");
  },
  10 * 60 * 1000,
);
// A failed spawn (wrong Electron path, missing node_modules) emits "error" and never "exit":
// write DONE right away so the runner does not wait out its full timeout.
child.on("error", (err) => {
  clearTimeout(timer);
  console.error(`[launcher] spawn failed: ${err.message}`);
  fs.writeFileSync(path.join(out, "DONE"), `spawn-error: ${err.message}`);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  console.error(`[launcher] electron exited code=${code} signal=${signal}`);
  fs.writeFileSync(path.join(out, "DONE"), String(code === null ? signal : code));
});
