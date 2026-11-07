#!/usr/bin/env bash
set -euo pipefail

# Makes macOS forget the icon it cached for Kaipu Record, so the Dock, ⌘-Tab and
# Finder show the logo that is inside the app today instead of an older one.
#
# Why this exists: macOS keeps a rendered copy of every app icon (IconServices, the
# Dock's own cache) and keeps serving it after the bundle's icon.icns changes. After
# the logo changed from the play-mark to the fox, some Docks kept drawing the old
# triangle although the installed bundle already carried the fox. Nothing in the repo
# was wrong; the cache was.
#
#   bun run icons:refresh                  (from apps/kaipu-record)
#   bun run icons:refresh -- "/path/App.app" ...   extra bundles to refresh
#
# It runs after `bun run icons` (see package.json) and is safe to run any time:
# it deletes only caches macOS rebuilds by itself, and restarts the Dock and Finder
# (a one-second flicker). It never touches the app or your recordings.
#
# macOS only. The system-wide store needs sudo; the script prints that one command
# instead of running it.

if [ "$(uname -s)" != "Darwin" ]; then
  echo "✗ macOS only." >&2
  exit 1
fi

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

apps=("/Applications/Kaipu Record.app" "$HOME/Applications/Kaipu Record.app" "$@")
for app in "${apps[@]}"; do
  [ -d "$app" ] || continue
  touch "$app"
  [ -x "$LSREGISTER" ] && "$LSREGISTER" -f "$app" >/dev/null 2>&1 || true
  echo "✓ re-registered $app"
done

# The per-user caches, all rebuilt by macOS on demand.
cache_dir="$(getconf DARWIN_USER_CACHE_DIR 2>/dev/null || true)"
user_dir="$(getconf DARWIN_USER_DIR 2>/dev/null || true)"
for stale in \
  "${cache_dir}com.apple.iconservices" \
  "${cache_dir}com.apple.iconservices.store" \
  "${cache_dir}com.apple.iconservicesagent" \
  "${cache_dir}com.apple.dock.iconcache" \
  "${user_dir}com.apple.dock.iconcache" \
  "$HOME/Library/Caches/com.apple.iconservices.store"; do
  case "$stale" in /com.apple.* | "com.apple."*) continue ;; esac
  if [ -e "$stale" ]; then
    rm -rf "$stale"
    echo "✓ removed $stale"
  fi
done

killall iconservicesagent 2>/dev/null || true
killall Dock 2>/dev/null || true
killall Finder 2>/dev/null || true
echo "✓ Dock and Finder restarted; the icon is redrawn from the app bundle"

if [ -e /Library/Caches/com.apple.iconservices.store ]; then
  echo
  echo "If the old icon is still there, clear the system-wide store once (needs your password):"
  echo "  sudo rm -rf /Library/Caches/com.apple.iconservices.store && killall Dock"
fi
