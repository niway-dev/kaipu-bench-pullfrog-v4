// NIW2-697 spike: renders UI-like screenshots with CoreText, plus ground-truth strings.
// Usage: make-text-fixtures <outDir>
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

struct Canvas {
    let ctx: CGContext; let scale: CGFloat; let logicalH: CGFloat
    var truth: [String] = []
    // y is top-left origin in logical points; baseline placed at y + size.
    mutating func text(_ s: String, x: CGFloat, y: CGFloat, size: CGFloat, mono: Bool = false,
                       weight: Bool = false, color: CGColor, record: Bool = true) {
        let name = mono ? "Menlo" : (weight ? "Helvetica-Bold" : "Helvetica")
        let font = CTFontCreateWithName(name as CFString, size * scale, nil)
        let attrs: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
        ctx.textPosition = CGPoint(x: x * scale, y: (logicalH - y - size) * scale)
        CTLineDraw(line, ctx)
        if record { truth.append(s) }
    }
    func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ c: CGColor, radius: CGFloat = 0) {
        ctx.setFillColor(c)
        let r = CGRect(x: x * scale, y: (logicalH - y - h) * scale, width: w * scale, height: h * scale)
        if radius > 0 { ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius * scale, cornerHeight: radius * scale, transform: nil)); ctx.fillPath() }
        else { ctx.fill(r) }
    }
}
func rgb(_ r: Int, _ g: Int, _ b: Int) -> CGColor { CGColor(red: CGFloat(r)/255, green: CGFloat(g)/255, blue: CGFloat(b)/255, alpha: 1) }

func render(name: String, pxW: Int, pxH: Int, scale: CGFloat, outDir: String) {
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    let ctx = CGContext(data: nil, width: pxW, height: pxH, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.setShouldAntialias(true); ctx.setShouldSmoothFonts(true)
    let lw = CGFloat(pxW) / scale, lh = CGFloat(pxH) / scale
    var c = Canvas(ctx: ctx, scale: scale, logicalH: lh)
    let dark = rgb(30, 30, 34), mid = rgb(90, 90, 98), white = rgb(255, 255, 255)
    c.rect(0, 0, lw, lh, rgb(236, 236, 240))
    c.rect(0, 0, lw, 38, rgb(246, 246, 248))                       // title bar
    for (i, col) in [rgb(255, 95, 86), rgb(255, 189, 46), rgb(39, 201, 63)].enumerated() {
        c.rect(14 + CGFloat(i) * 20, 13, 12, 12, col, radius: 6)
    }
    c.text("Quarterly Report - Kaipu Dashboard", x: lw / 2 - 130, y: 10, size: 13, weight: true, color: dark)
    c.rect(0, 38, 220, lh - 38, rgb(225, 226, 232))                // sidebar
    for (i, s) in ["Overview", "Recordings", "Projects", "Exports", "Settings", "Shortcuts", "Account"].enumerated() {
        c.text(s, x: 24, y: 60 + CGFloat(i) * 30, size: 13, color: dark)
    }
    c.text("STORAGE 12.4 GB used", x: 24, y: lh - 60, size: 11, color: mid)
    let cx: CGFloat = 250
    c.text("Project summary", x: cx, y: 60, size: 28, weight: true, color: dark)
    let para = ["The recording pipeline captures the screen at sixty frames per second",
                "and stores each take in the local vault before any export begins.",
                "Exports use the selected preset, so a clip shared on chat stays small."]
    for (i, s) in para.enumerated() { c.text(s, x: cx, y: 110 + CGFloat(i) * 24, size: 15, color: dark) }
    c.text("Last synced 14:32 - 3 items pending - Wi-Fi connected", x: cx, y: 200, size: 11, color: mid)
    c.text("Tip: press Cmd+Shift+5 to start a new capture", x: cx, y: 220, size: 12, color: mid)
    // table
    let ty: CGFloat = 270
    c.rect(cx, ty, 760, 30, rgb(210, 212, 222))
    let cols: [CGFloat] = [0, 220, 340, 460, 600]
    for (i, h) in ["Name", "Duration", "Size MB", "Status", "Date"].enumerated() {
        c.text(h, x: cx + 10 + cols[i], y: ty + 8, size: 12, weight: true, color: dark)
    }
    let rows = [["demo-take-01", "00:42", "318.5", "Ready", "2026-11-02"],
                ["onboarding", "03:17", "1204.9", "Exported", "2026-11-03"],
                ["bug-repro-77", "00:09", "64.2", "Ready", "2026-11-05"],
                ["standup", "12:50", "2890.1", "Pending", "2026-11-09"],
                ["launch-v2", "01:05", "512.0", "Exported", "2026-11-10"]]
    for (r, row) in rows.enumerated() {
        let yy = ty + 38 + CGFloat(r) * 28
        if r % 2 == 1 { c.rect(cx, yy - 6, 760, 26, rgb(244, 244, 248)) }
        for (i, cell) in row.enumerated() { c.text(cell, x: cx + 10 + cols[i], y: yy, size: 12, color: dark) }
    }
    c.rect(cx, 470, 150, 36, rgb(10, 100, 240), radius: 8)         // button
    c.text("Export video", x: cx + 28, y: 479, size: 14, weight: true, color: white)
    c.rect(cx, 530, 760, 60, rgb(28, 30, 36), radius: 6)           // code block
    c.text("const result = await recognize(path, { level: \"accurate\" });", x: cx + 14, y: 553, size: 13, mono: true, color: rgb(190, 230, 160))
    c.text("Ready to export 5 recordings", x: cx, y: 620, size: 18, weight: true, color: dark)

    let img = ctx.makeImage()!
    let url = URL(fileURLWithPath: outDir).appendingPathComponent("\(name).png")
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, img, nil); CGImageDestinationFinalize(dest)
    let words = c.truth.flatMap { $0.split(whereSeparator: { $0 == " " }).map(String.init) }
    let json: [String: Any] = ["name": name, "width": pxW, "height": pxH, "scale": scale, "strings": c.truth, "words": words]
    try! JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted]).write(to: URL(fileURLWithPath: outDir).appendingPathComponent("\(name).truth.json"))
    print("wrote \(name).png \(pxW)x\(pxH) (\(words.count) ground-truth words)")
}

@main struct Main {
    static func main() {
        let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
        try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
        render(name: "fhd-1x", pxW: 1920, pxH: 1080, scale: 1, outDir: out)
        render(name: "retina-3024x1964-2x", pxW: 3024, pxH: 1964, scale: 2, outDir: out)
    }
}
