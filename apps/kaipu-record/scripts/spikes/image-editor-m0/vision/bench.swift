// NIW2-697 spike: spawns the helper like Electron main would (Process + pipe + timeout),
// measures wall clock, aggregates. Usage: bench <helper> <fixtureDir> <resultsJson> <runsAfterFirst>
import Foundation

@inline(__always) func nowNs() -> UInt64 { clock_gettime_nsec_np(CLOCK_UPTIME_RAW) }
func median(_ a: [Double]) -> Double { let s = a.sorted(); return s.isEmpty ? 0 : (s.count % 2 == 1 ? s[s.count/2] : (s[s.count/2-1] + s[s.count/2]) / 2) }
func r(_ d: Double) -> Double { (d * 10).rounded() / 10 }

func run(_ helper: String, _ png: String, _ level: String, timeout: Double = 60) -> (wallMs: Double, json: [String: Any]?) {
    let p = Process(); p.executableURL = URL(fileURLWithPath: helper)
    p.arguments = [png, "--level", level]
    let pipe = Pipe(); p.standardOutput = pipe; p.standardError = FileHandle.nullDevice
    let t0 = nowNs()
    try! p.run()
    let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }
    DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: killer)
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    let wall = Double(nowNs() - t0) / 1e6
    killer.cancel()
    return (wall, try? JSONSerialization.jsonObject(with: data) as? [String: Any])
}

@main struct Main { static func main() {
let a = CommandLine.arguments
let helper = a[1], dir = a[2], outPath = a[3], n = Int(a[4]) ?? 5
var results: [[String: Any]] = []
print(String(format: "%-22@ %-9@ %9@ %9@ %9@ %10@ %6@ %7@", "fixture" as NSString, "level" as NSString, "first(ms)" as NSString, "median" as NSString, "max" as NSString, "recogMed" as NSString, "words" as NSString, "recall" as NSString))
for fx in ["fhd-1x", "retina-3024x1964-2x"] {
    let png = "\(dir)/\(fx).png"
    let truth = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: "\(dir)/\(fx).truth.json"))) as! [String: Any]
    let truthWords = truth["words"] as! [String]
    for level in ["accurate", "fast"] {
        var walls: [Double] = [], recog: [Double] = [], firstWall = 0.0, firstRecog = 0.0
        var lastWords: [String] = [], lineCount = 0
        for i in 0...n {
            let (w, j) = run(helper, png, level)
            guard let j = j else { print("run failed for \(fx) \(level)"); continue }
            let rec = ((j["timings"] as? [String: Any])?["recognizeMs"] as? Double) ?? 0
            if i == 0 { firstWall = w; firstRecog = rec } else { walls.append(w); recog.append(rec) }
            lastWords = (j["words"] as? [[String: Any]] ?? []).compactMap { $0["text"] as? String }
            lineCount = j["lines"] as? Int ?? 0
        }
        var pool: [String: Int] = [:]; for w in lastWords { pool[w, default: 0] += 1 }
        var hit = 0; for w in truthWords { if let c = pool[w], c > 0 { pool[w] = c - 1; hit += 1 } }
        let recall = Double(hit) / Double(truthWords.count)
        let mx = walls.max() ?? 0, med = median(walls)
        results.append(["fixture": fx, "level": level, "firstRunWallMs": r(firstWall), "firstRunRecognizeMs": r(firstRecog),
                        "medianWallMs": r(med), "maxWallMs": r(mx), "walls": walls.map(r),
                        "recognizeMsMedian": r(median(recog)), "words": lastWords.count, "lines": lineCount,
                        "groundTruthWords": truthWords.count, "groundTruthHit": hit, "recall": (recall * 1000).rounded() / 1000])
        print(String(format: "%-22@ %-9@ %9.0f %9.0f %9.0f %10.0f %6d %6.1f%%", fx as NSString, level as NSString, firstWall, med, mx, median(recog), lastWords.count, recall * 100))
    }
}
try! JSONSerialization.data(withJSONObject: ["results": results], options: [.prettyPrinted]).write(to: URL(fileURLWithPath: outPath))
}}
