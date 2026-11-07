# Windows counterpart of refresh-icon-cache.sh: makes Windows forget the icon it cached
# for Kaipu Record, so the desktop shortcut, taskbar and Start menu show the logo that
# is inside the app today and not an older one.
#
#   bun run icons:refresh:win          (from apps/kaipu-record)
#
# The installer already asks Explorer to redraw its icons after every install and
# update (build/installer.nsh). Run this by hand, AFTER installing the new build, when an
# icon is still wrong, for example a pinned shortcut. It deletes only the icon cache
# (never the thumbnail cache, which holds previews of your files), and restarts Explorer
# (the taskbar disappears for a second). It never touches the app or your recordings.

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  Write-Error "Windows only."
  exit 1
}

# Windows restarts the shell by itself when explorer.exe dies, and the new one reopens
# iconcache_*.db. Wait until no explorer process is left before deleting.
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
for ($i = 0; $i -lt 20 -and (Get-Process -Name explorer -ErrorAction SilentlyContinue); $i++) {
  Start-Sleep -Milliseconds 250
}

$explorerDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Explorer"
$stale = @(Join-Path $env:LOCALAPPDATA "IconCache.db")
$stale += Get-ChildItem -Path $explorerDir -Filter "iconcache_*.db" -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }

$left = @()
foreach ($file in $stale) {
  if (-not (Test-Path $file)) { continue }
  Remove-Item $file -Force -ErrorAction SilentlyContinue
  if (Test-Path $file) {
    $left += $file
  } else {
    Write-Host "removed $file"
  }
}

# Start the shell only if Windows did not already bring it back (a second explorer.exe
# would just open a File Explorer window).
if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
  Start-Process explorer.exe
}
# Rebuild the shell's icon cache now instead of on the next sign-in.
& "$env:SystemRoot\System32\ie4uinit.exe" -show

if ($left.Count -gt 0) {
  Write-Warning "Still locked, not removed (sign out and in, then run this again):"
  $left | ForEach-Object { Write-Warning "  $_" }
  exit 1
}
Write-Host "Explorer restarted; icons are redrawn from the app."
