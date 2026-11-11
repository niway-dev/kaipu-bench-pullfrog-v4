// NIW2-697 spike: color fixtures + a raw-pixel reader.
//
//   swiftc -O make-fixtures.swift -o fixtures-tool
//   fixtures-tool make <outDir> <monitor-profile.icc>
//   fixtures-tool raw  <png> <samples.json> <out.json>
//
// `make` writes srgb-swatches.png/.json, p3-swatches.png/.json,
// monitor-profile-swatches.png/.json and 6k.png into <outDir>.
// `raw` decodes a PNG with ImageIO and prints the UNCONVERTED samples (the bytes as stored,
// in the PNG's own color space) at the given points: the ground truth for Chromium's
// colorSpaceConversion:'none' mode.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let block = 32
let cols = 8

// 24 sRGB swatches: the ones the editor will meet (UI greys, brand blues) plus near-duplicates.
let srgbHex: [String] = [
  "000000", "ffffff", "ff0000", "00ff00", "0000ff", "808080", "fafafa", "f5f5f5",
  "3b82f6", "1e293b", "ef4444", "10b981", "fefefe", "fdfdfd", "010101", "0a0a0a",
  "f59e0b", "8b5cf6", "64748b", "e2e8f0", "0f172a", "475569", "f1f5f9", "ffedd5",
]

// 16 Display P3 swatches, as 8-bit P3-encoded values. `oog` marks values outside sRGB.
// The four sRGB equivalents were computed once from the CSS Color 4 matrices.
struct P3Swatch { let name: String; let rgb: [Int]; let oog: Bool }
let p3Swatches: [P3Swatch] = [
  P3Swatch(name: "p3-black", rgb: [0, 0, 0], oog: false),
  P3Swatch(name: "p3-white", rgb: [255, 255, 255], oog: false),
  P3Swatch(name: "p3-grey128", rgb: [128, 128, 128], oog: false),
  P3Swatch(name: "p3-grey250", rgb: [250, 250, 250], oog: false),
  P3Swatch(name: "p3-eq-3b82f6", rgb: [78, 128, 238], oog: false),
  P3Swatch(name: "p3-eq-1e293b", rgb: [32, 41, 58], oog: false),
  P3Swatch(name: "p3-eq-ef4444", rgb: [221, 82, 76], oog: false),
  P3Swatch(name: "p3-eq-10b981", rgb: [85, 182, 133], oog: false),
  P3Swatch(name: "p3-arb-orange", rgb: [200, 120, 60], oog: false),
  P3Swatch(name: "p3-arb-teal", rgb: [30, 200, 180], oog: false),
  P3Swatch(name: "p3-arb-purple", rgb: [90, 40, 160], oog: false),
  P3Swatch(name: "p3-red", rgb: [255, 0, 0], oog: true),
  P3Swatch(name: "p3-green", rgb: [0, 255, 0], oog: true),
  P3Swatch(name: "p3-blue", rgb: [0, 0, 255], oog: true),
  P3Swatch(name: "p3-amber", rgb: [255, 128, 0], oog: true),
  P3Swatch(name: "p3-cyan", rgb: [0, 255, 255], oog: true),
]

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

func writePNG(_ image: CGImage, to path: String) {
  let url = URL(fileURLWithPath: path) as CFURL
  guard let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)
  else { fail("cannot create \(path)") }
  CGImageDestinationAddImage(dest, image, nil)
  guard CGImageDestinationFinalize(dest) else { fail("cannot write \(path)") }
}

func swatchImage(space: CGColorSpace, count: Int, color: (Int) -> [Int]) -> CGImage {
  let rows = (count + cols - 1) / cols
  let width = cols * block
  let height = rows * block
  guard
    let ctx = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
  else { fail("cannot create context") }
  ctx.setFillColor(CGColor(colorSpace: space, components: [0.5, 0.5, 0.5, 1])!)
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  for i in 0..<count {
    let v = color(i)
    let comps: [CGFloat] = [CGFloat(v[0]) / 255, CGFloat(v[1]) / 255, CGFloat(v[2]) / 255, 1]
    ctx.setFillColor(CGColor(colorSpace: space, components: comps)!)
    let col = i % cols
    let row = i / cols
    // CoreGraphics origin is bottom-left; keep swatch 0 at the top-left of the PNG.
    ctx.fill(CGRect(x: col * block, y: height - (row + 1) * block, width: block, height: block))
  }
  return ctx.makeImage()!
}

func jsonString(_ object: Any) -> String {
  let data = try! JSONSerialization.data(
    withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
  return String(data: data, encoding: .utf8)!
}

func swatchRecord(_ i: Int) -> [String: Any] {
  ["index": i, "x": (i % cols) * block + block / 2, "y": (i / cols) * block + block / 2]
}

func hexRGB(_ hex: String) -> [Int] {
  let v = Int(hex, radix: 16)!
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

func make(outDir: String, iccPath: String) {
  try? FileManager.default.createDirectory(
    atPath: outDir, withIntermediateDirectories: true)

  // a. sRGB swatches
  let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
  writePNG(
    swatchImage(space: srgb, count: srgbHex.count) { hexRGB(srgbHex[$0]) },
    to: "\(outDir)/srgb-swatches.png")
  var srgbRecords: [[String: Any]] = []
  for (i, h) in srgbHex.enumerated() {
    var r = swatchRecord(i)
    r["name"] = "#" + h
    r["hex"] = "#" + h
    r["srgb"] = hexRGB(h)
    srgbRecords.append(r)
  }
  let srgbDoc: [String: Any] = [
    "file": "srgb-swatches.png", "tag": "sRGB", "block": block, "cols": cols,
    "swatches": srgbRecords,
  ]
  try! jsonString(srgbDoc).write(
    toFile: "\(outDir)/srgb-swatches.json", atomically: true, encoding: .utf8)

  // b. Display P3 swatches. Expected sRGB is computed in JS, not here.
  let p3 = CGColorSpace(name: CGColorSpace.displayP3)!
  writePNG(
    swatchImage(space: p3, count: p3Swatches.count) { p3Swatches[$0].rgb },
    to: "\(outDir)/p3-swatches.png")
  var p3Records: [[String: Any]] = []
  for (i, s) in p3Swatches.enumerated() {
    var r = swatchRecord(i)
    r["name"] = s.name
    r["p3"] = s.rgb
    r["outOfSrgbGamut"] = s.oog
    p3Records.append(r)
  }
  let p3Doc: [String: Any] = [
    "file": "p3-swatches.png", "tag": "Display P3", "block": block, "cols": cols,
    "swatches": p3Records,
  ]
  try! jsonString(p3Doc).write(
    toFile: "\(outDir)/p3-swatches.json", atomically: true, encoding: .utf8)

  // c. sRGB swatches converted by ColorSync into the monitor profile and tagged with it.
  let sips = Process()
  sips.executableURL = URL(fileURLWithPath: "/usr/bin/sips")
  sips.arguments = [
    "--matchTo", iccPath, "\(outDir)/srgb-swatches.png",
    "--out", "\(outDir)/monitor-profile-swatches.png",
  ]
  sips.standardOutput = FileHandle.nullDevice
  try! sips.run()
  sips.waitUntilExit()
  if sips.terminationStatus != 0 { fail("sips --matchTo failed") }
  var monitorDoc = srgbDoc
  monitorDoc["file"] = "monitor-profile-swatches.png"
  monitorDoc["tag"] = "monitor profile (g27fc-display.icc), expected readout = original sRGB hex"
  try! jsonString(monitorDoc).write(
    toFile: "\(outDir)/monitor-profile-swatches.json", atomically: true, encoding: .utf8)

  // d. 6144x3456: gradient + noise, so PNG compression cannot shrink it to nothing.
  let w = 6144
  let h = 3456
  var buf = [UInt8](repeating: 255, count: w * h * 4)
  var seed: UInt64 = 0x9E37_79B9_7F4A_7C15
  for y in 0..<h {
    for x in 0..<w {
      seed ^= seed << 13
      seed ^= seed >> 7
      seed ^= seed << 17
      let noise = Int(seed & 31) - 16
      let o = (y * w + x) * 4
      let r = x * 255 / w
      let g = y * 255 / h
      let b = (x + y) * 255 / (w + h)
      buf[o] = UInt8(max(0, min(255, r + noise)))
      buf[o + 1] = UInt8(max(0, min(255, g + noise)))
      buf[o + 2] = UInt8(max(0, min(255, b + noise)))
    }
  }
  buf.withUnsafeMutableBytes { raw in
    let ctx = CGContext(
      data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
      space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    writePNG(ctx.makeImage()!, to: "\(outDir)/6k.png")
  }
}

func raw(pngPath: String, samplesPath: String, outPath: String) {
  guard
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: pngPath) as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
    let data = image.dataProvider?.data
  else { fail("cannot decode \(pngPath)") }
  let bytes = CFDataGetBytePtr(data)!
  let bpp = image.bitsPerPixel / 8
  let bpc = image.bitsPerComponent / 8
  let stride = image.bytesPerRow
  let points =
    try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: samplesPath)))
    as! [[String: Any]]
  var out: [[Int]] = []
  for p in points {
    let x = (p["x"] as! NSNumber).intValue
    let y = (p["y"] as! NSNumber).intValue
    // Component order is R,G,B for PNG decodes; for 16-bit take the high byte.
    let o = y * stride + x * bpp
    out.append([Int(bytes[o]), Int(bytes[o + bpc]), Int(bytes[o + 2 * bpc])])
  }
  let profile = (image.colorSpace?.name as String?) ?? "(unnamed/ICC)"
  let doc: [String: Any] = [
    "width": image.width, "height": image.height, "bitsPerComponent": image.bitsPerComponent,
    "bitsPerPixel": image.bitsPerPixel, "alphaInfo": image.alphaInfo.rawValue,
    "colorSpaceName": profile, "samples": out,
  ]
  try! jsonString(doc).write(toFile: outPath, atomically: true, encoding: .utf8)
}

let args = CommandLine.arguments
if args.count == 4 && args[1] == "make" {
  make(outDir: args[2], iccPath: args[3])
} else if args.count == 5 && args[1] == "raw" {
  raw(pngPath: args[2], samplesPath: args[3], outPath: args[4])
} else {
  fail("usage: fixtures-tool make <outDir> <icc> | raw <png> <samples.json> <out.json>")
}
