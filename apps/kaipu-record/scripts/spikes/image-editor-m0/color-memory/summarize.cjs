// Prints the headline numbers of a results-<host>.json.   node summarize.cjs <results.json>
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const e = (c) =>
  c
    ? `${c.maxErr.join("/")} worst=${c.worst ? `${c.worst.name} exp ${c.worst.expected} got ${c.worst.got}` : "-"}`
    : "-";
console.log(
  `\nhost ${r.host}: ${r.machine.model} ${r.machine.cpu}, macOS ${r.machine.macOS}, Electron ${r.machine.electron} (Chrome ${r.machine.chrome})`,
);
console.log("displays:", JSON.stringify(r.machine.displays));
console.log("errors:", JSON.stringify(r.errors));
console.log("\n== fixtures: max abs error R/G/B (in-gamut), worst swatch");
for (const [name, f] of Object.entries(r.fixtures || {})) {
  console.log(`${name} [embedded: ${f.embeddedProfile}]`);
  for (const [mode, m] of Object.entries(f.modes)) {
    console.log(`  ${mode.padEnd(5)} ${e(m.inGamut)}`);
    if (m.outOfGamut) console.log(`        out-of-gamut: ${e(m.outOfGamut)}`);
    if (m.vsCoreGraphicsRaw)
      console.log(`        vs CoreGraphics raw bytes: ${e(m.vsCoreGraphicsRaw)}`);
  }
}
const c = r.capture;
if (c) {
  console.log(
    `\n== capture round-trip: profile=${c.embeddedProfile} px=${c.pixelSize} scale=${c.scaleFactor} screencapture=${JSON.stringify(c.screencapture)} ${c.error || ""}`,
  );
  for (const [mode, m] of Object.entries(c.modes || {})) {
    console.log(`  ${mode.padEnd(5)} css hex: ${e(m.cssHexSwatches)}`);
    console.log(`        css p3 in-gamut: ${e(m.cssP3InGamut)}`);
    console.log(`        css p3 out-of-gamut: ${e(m.cssP3OutOfGamut)}`);
    if (m.vsCoreGraphicsRaw) console.log(`        vs CoreGraphics raw: ${e(m.vsCoreGraphicsRaw)}`);
  }
}
for (const [variant, m] of Object.entries(r.memory || {})) {
  console.log(
    `\n== memory, ${variant} (median of ${m.reps} fresh-window reps, MiB delta vs baseline); theoretical ${m.image.theoreticalMiB} MiB`,
  );
  console.log("baseline:", JSON.stringify(m.baselineMiB));
  for (const [s, v] of Object.entries(m.medianDeltaMiB))
    console.log(`  ${s.padEnd(15)} ${JSON.stringify(v)}`);
  console.log("decode ms:", JSON.stringify(m.decodeMs));
}
