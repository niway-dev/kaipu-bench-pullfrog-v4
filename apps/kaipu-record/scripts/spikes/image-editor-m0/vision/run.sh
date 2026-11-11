#!/usr/bin/env bash
# NIW2-697 spike: build the Vision helper + fixtures, measure latency. Usage: run.sh [outDir] [runsAfterFirst]
set -euo pipefail
cd "$(dirname "$0")"
HOST="$(hostname -s)"
OUT="${1:-/tmp/niw2-697/vision-$HOST}"
RUNS="${2:-5}"
mkdir -p "$OUT/bin" "$OUT/fixtures"
ARCH="$(uname -m)"; TARGET="$ARCH-apple-macos13.0"   # deployment target macOS 13 (Vision accurate API revision 3)
echo "== machine"; {
  echo "cpu: $(sysctl -n machdep.cpu.brand_string)"; echo "model: $(sysctl -n hw.model)"
  echo "memsize: $(sysctl -n hw.memsize)"; echo "macOS: $(sw_vers -productVersion)"
  echo "swiftc: $(xcrun swiftc --version 2>&1 | head -1)"; echo "target: $TARGET"
} | tee "$OUT/machine.txt"
for f in text-recognition-spike make-text-fixtures bench; do
  xcrun swiftc -O -parse-as-library -swift-version 5 -target "$TARGET" "$f.swift" -o "$OUT/bin/$f"
done
"$OUT/bin/make-text-fixtures" "$OUT/fixtures"
# First run of the helper happens right after the build, inside bench (run index 0 per fixture x level).
"$OUT/bin/bench" "$OUT/bin/text-recognition-spike" "$OUT/fixtures" "$OUT/results-$HOST.json" "$RUNS" | tee "$OUT/summary.txt"
cp "$OUT/results-$HOST.json" "$OUT/../results-$HOST.json" 2>/dev/null || true
echo "results: $OUT/results-$HOST.json"
