// Draws `settings-text.png`, the screenshot with real text the UI catalog and the
// `verify/image-text.verify.ts` proof open in the image editor (NIW2-705).
//
// Regenerate (macOS, Xcode Command Line Tools), from apps/kaipu-record:
//   swiftc -parse-as-library -O ui-catalog/fixtures/text/make-settings-text.swift -o /tmp/make-settings-text
//   /tmp/make-settings-text ui-catalog/fixtures/text/settings-text.png
//
// Plain 1x pixels, Helvetica at 12-20 px, one string per row so a recognized line is the
// string below. The text is generic on purpose: images leave the machine with the catalog.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let width = 560, height = 340

func rgb(_ r: Int, _ g: Int, _ b: Int) -> CGColor {
    CGColor(red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: 1)
}

@main struct Main {
    static func main() {
        let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "settings-text.png"
        let space = CGColorSpace(name: CGColorSpace.sRGB)!
        let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                            space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setShouldAntialias(true)
        ctx.setShouldSmoothFonts(true)
        // Top-left origin helpers: y is the top of a box, in pixels.
        func rect(_ x: Int, _ y: Int, _ w: Int, _ h: Int, _ color: CGColor, radius: CGFloat = 0) {
            let r = CGRect(x: x, y: height - y - h, width: w, height: h)
            ctx.setFillColor(color)
            if radius > 0 { ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil)); ctx.fillPath() }
            else { ctx.fill(r) }
        }
        func text(_ s: String, x: Int, y: Int, size: CGFloat, bold: Bool = false, color: CGColor) {
            let font = CTFontCreateWithName((bold ? "Helvetica-Bold" : "Helvetica") as CFString, size, nil)
            let attrs: [NSAttributedString.Key: Any] = [
                NSAttributedString.Key(kCTFontAttributeName as String): font,
                NSAttributedString.Key(kCTForegroundColorAttributeName as String): color]
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
            ctx.textPosition = CGPoint(x: CGFloat(x), y: CGFloat(height - y) - size)
            CTLineDraw(line, ctx)
        }
        let dark = rgb(30, 30, 34), mid = rgb(96, 96, 104)
        rect(0, 0, width, height, rgb(244, 244, 247))
        rect(0, 0, width, 44, rgb(232, 233, 238))
        text("Display settings", x: 28, y: 12, size: 20, bold: true, color: dark)
        let rows = ["Language: English", "Theme: Dark mode", "Frame rate: 60 fps"]
        for (i, row) in rows.enumerated() {
            let y = 74 + i * 56
            rect(28, y, width - 56, 44, rgb(255, 255, 255), radius: 8)
            text(row, x: 44, y: y + 14, size: 15, color: dark)
        }
        text("Changes apply the next time you record", x: 28, y: 252, size: 12, color: mid)
        rect(28, 284, 150, 36, rgb(10, 100, 240), radius: 8)
        text("Save changes", x: 56, y: 294, size: 14, bold: true, color: rgb(255, 255, 255))

        let url = URL(fileURLWithPath: out)
        let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
        CGImageDestinationFinalize(dest)
        print("wrote \(out) \(width)x\(height)")
    }
}
