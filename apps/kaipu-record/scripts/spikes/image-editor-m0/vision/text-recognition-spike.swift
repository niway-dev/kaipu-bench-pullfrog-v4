// NIW2-697 spike: Apple Vision text recognition from a CLI helper.
// Usage: text-recognition-spike <png> [--level accurate|fast] [--no-language-correction]
import Foundation
import ImageIO
import CoreGraphics
import Vision

@inline(__always) func nowNs() -> UInt64 { clock_gettime_nsec_np(CLOCK_UPTIME_RAW) }
func ms(_ a: UInt64, _ b: UInt64) -> Double { (Double(b - a) / 1e6 * 100).rounded() / 100 }

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write(Data((msg + "\n").utf8))
    exit(1)
}

struct Rect: Codable { var x: Double; var y: Double; var w: Double; var h: Double }
struct Word: Codable { var text: String; var rect: Rect; var line: Int; var confidence: Float }
struct Timings: Codable { var loadMs: Double; var recognizeMs: Double; var totalMs: Double }
struct Output: Codable {
    var version: Int; var width: Int; var height: Int; var level: String
    var timings: Timings; var lines: Int; var words: [Word]
}

@main struct Main {
    static func main() {
        let t0 = nowNs()
        var args = Array(CommandLine.arguments.dropFirst())
        guard !args.isEmpty else { fail("usage: text-recognition-spike <png> [--level accurate|fast] [--no-language-correction]") }
        let path = args.removeFirst()
        var level = "accurate"; var correction = true
        var i = 0
        while i < args.count {
            switch args[i] {
            case "--level": i += 1; if i < args.count { level = args[i] }
            case "--no-language-correction": correction = false
            default: fail("unknown argument \(args[i])")
            }
            i += 1
        }
        guard level == "accurate" || level == "fast" else { fail("bad level") }
        guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fail("cannot load \(path)") }
        let W = image.width, H = image.height
        let t1 = nowNs()

        let req = VNRecognizeTextRequest()
        req.recognitionLevel = level == "fast" ? .fast : .accurate
        req.usesLanguageCorrection = correction
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do { try handler.perform([req]) } catch { fail("vision failed: \(error)") }
        let t2 = nowNs()

        var words: [Word] = []
        let obs = (req.results ?? [])
        for (li, o) in obs.enumerated() {
            guard let cand = o.topCandidates(1).first else { continue }
            let s = cand.string
            var idx = s.startIndex
            while idx < s.endIndex {
                while idx < s.endIndex, s[idx].isWhitespace { idx = s.index(after: idx) }
                if idx == s.endIndex { break }
                var end = idx
                while end < s.endIndex, !s[end].isWhitespace { end = s.index(after: end) }
                let range = idx..<end
                if let box = try? cand.boundingBox(for: range) {
                    let b = box.boundingBox  // normalized, bottom-left origin
                    let x = b.minX * Double(W), w = b.width * Double(W)
                    let h = b.height * Double(H)
                    let y = (1 - b.maxY) * Double(H)
                    words.append(Word(text: String(s[range]),
                        rect: Rect(x: x.rounded(), y: y.rounded(), w: w.rounded(), h: h.rounded()),
                        line: li, confidence: cand.confidence))
                }
                idx = end
            }
        }
        let t3 = nowNs()
        let out = Output(version: 1, width: W, height: H, level: level,
                         timings: Timings(loadMs: ms(t0, t1), recognizeMs: ms(t1, t2), totalMs: ms(t0, t3)),
                         lines: obs.count, words: words)
        let enc = JSONEncoder()
        FileHandle.standardOutput.write(try! enc.encode(out))
        print()
    }
}
