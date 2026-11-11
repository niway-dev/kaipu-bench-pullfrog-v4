// Text recognition helper (ADR 0055): Apple Vision on a PNG read from stdin.
//   kaipu-text-recognition --version   -> kaipu-text-recognition/1
//   kaipu-text-recognition --stdin     -> one JSON line, rects in top-left source pixels
// Errors go to stderr with exit 1. Build: scripts/build-text-recognition.sh
import Foundation
import ImageIO
import CoreGraphics
import Vision

let helperVersion = "kaipu-text-recognition/1"

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

struct Rect: Codable { var x: Double; var y: Double; var w: Double; var h: Double }
struct Word: Codable { var text: String; var rect: Rect; var line: Int; var confidence: Float }
struct Output: Codable { var version: Int; var width: Int; var height: Int; var words: [Word] }

func clamp(_ value: Double, _ low: Double, _ high: Double) -> Double { min(max(value, low), high) }

@main struct Main {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        if args == ["--version"] {
            print(helperVersion)
            exit(0)
        }
        guard args == ["--stdin"] else { fail("usage: kaipu-text-recognition --version | --stdin") }

        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard !data.isEmpty,
              let src = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fail("cannot decode the image") }
        let width = image.width, height = image.height
        let W = Double(width), H = Double(height)

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        do { try VNImageRequestHandler(cgImage: image, options: [:]).perform([request]) }
        catch { fail("vision failed: \(error.localizedDescription)") }

        var words: [Word] = []
        for (line, observation) in (request.results ?? []).enumerated() {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let s = candidate.string
            var index = s.startIndex
            while index < s.endIndex {
                while index < s.endIndex, s[index].isWhitespace { index = s.index(after: index) }
                if index == s.endIndex { break }
                var end = index
                while end < s.endIndex, !s[end].isWhitespace { end = s.index(after: end) }
                let range = index..<end
                index = end
                guard let box = try? candidate.boundingBox(for: range) else { continue }
                let b = box.boundingBox  // normalized, bottom-left origin
                let x0 = clamp((b.minX * W).rounded(), 0, W)
                let x1 = clamp((b.maxX * W).rounded(), 0, W)
                let y0 = clamp(((1 - b.maxY) * H).rounded(), 0, H)
                let y1 = clamp(((1 - b.minY) * H).rounded(), 0, H)
                words.append(Word(text: String(s[range]),
                                  rect: Rect(x: x0, y: y0, w: x1 - x0, h: y1 - y0),
                                  line: line, confidence: min(max(candidate.confidence, 0), 1)))
            }
        }
        let out = Output(version: 1, width: width, height: height, words: words)
        guard let json = try? JSONEncoder().encode(out) else { fail("cannot encode the result") }
        FileHandle.standardOutput.write(json)
        FileHandle.standardOutput.write(Data("\n".utf8))
    }
}
