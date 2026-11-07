# Windows counterpart of refresh-icon-cache.sh: makes Windows forget the icon it cached
# for Kaipu Record, so the desktop shortcut, taskbar and Start menu show the logo that
# is inside the app today and not an older one.
#
#   bun run icons:refresh:win          (from apps/kaipu-record)
#
# The installer already asks Explorer to redraw its icons after every install and
# update (build/installer.nsh). Run this by hand when an icon is still wrong, for
# example on a machine that got the old logo from a portable copy or a pinned shortcut.
#
# It deletes only caches Windows rebuilds by itself, and restarts Explorer (the taskbar
# disappears for a second). It never touches the app or your recordings.

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  Write-Error "Windows only."
  exit 1
}

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$explorerDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Explorer"
$stale = @(Join-Path $env:LOCALAPPDATA "IconCache.db")
$stale += Get-ChildItem -Path $explorerDir -Filter "iconcache_*.db" -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
$stale += Get-ChildItem -Path $explorerDir -Filter "thumbcache_*.db" -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }

foreach ($file in $stale) {
  if (Test-Path $file) {
    Remove-Item $file -Force -ErrorAction SilentlyContinue
    Write-Host "removed $file"
  }
}

Start-Process explorer.exe
# Rebuild the shell's icon cache now instead of on the next sign-in.
& "$env:SystemRoot\System32\ie4uinit.exe" -show
Write-Host "Explorer restarted; icons are redrawn from the app."
