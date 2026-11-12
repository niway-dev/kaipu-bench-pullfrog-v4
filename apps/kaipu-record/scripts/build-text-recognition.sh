#!/usr/bin/env bash
# Builds the text recognition helper (Apple Vision, ADR 0055).
# It is optional: without it text recognition reports "unavailable", so a missing Swift
# toolchain warns instead of blocking `bun run dev` or `bun run build`.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || exit 0
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$APP_ROOT/native/text-recognition/main.swift"
OUTPUT="${1:-$APP_ROOT/resources/native/kaipu-text-recognition}"
if ! xcrun --find swiftc >/dev/null 2>&1; then
  echo "warning: swiftc not found; skipping the text recognition helper." >&2
  echo "         Install the Xcode Command Line Tools to build it: xcode-select --install" >&2
  exit 0
fi
# Skip the two-architecture compile when the binary is newer than its source and this script.
if [[ -x "$OUTPUT" && "$OUTPUT" -nt "$SOURCE" && "$OUTPUT" -nt "$0" ]]; then
  exit 0
fi
mkdir -p "$(dirname "$OUTPUT")"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
skip() {
  # Drop a stale helper too, so the message holds: no helper, no recognition.
  rm -f "$OUTPUT"
  echo "warning: could not build the text recognition helper ($1); text recognition is unavailable." >&2
  exit 0
}
for ARCH in arm64 x86_64; do
  xcrun swiftc -parse-as-library -swift-version 5 -O -target "$ARCH-apple-macos13.0" "$SOURCE" -o "$BUILD_DIR/$ARCH" ||
    skip "compile $ARCH"
done
xcrun lipo -create "$BUILD_DIR/arm64" "$BUILD_DIR/x86_64" -output "$OUTPUT" || skip "lipo"
