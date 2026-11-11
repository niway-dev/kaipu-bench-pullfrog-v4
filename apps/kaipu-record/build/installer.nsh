; electron-builder includes build/installer.nsh in the NSIS installer automatically.
;
; Windows caches every icon it has drawn (iconcache_*.db) and keeps serving it after
; the .exe's icon changed, so an update can still show the previous logo on the desktop
; shortcut, the taskbar and the Start menu. Telling the shell that file associations
; changed (SHCNE_ASSOCCHANGED) makes Explorer drop and redraw its icons. It runs after
; every install and update, so a new logo never waits for a reboot.
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'
!macroend
