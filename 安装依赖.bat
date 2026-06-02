@echo off
cd /d D:\build\GitLocal\claude-code-companion
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
npm exec install-electron -- --no
pause
