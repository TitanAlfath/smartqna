@echo off
set "PATH=C:\Users\Lenovo\AppData\Local\nvm\v20.19.6;%PATH%"
echo Menjalankan Production Preview Server SmartQ^&A...
"C:\Users\Lenovo\AppData\Local\nvm\v20.19.6\node.exe" "./node_modules/vite/bin/vite.js" preview --host
