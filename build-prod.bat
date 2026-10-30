@echo off
set "PATH=C:\Users\Lenovo\AppData\Local\nvm\v20.19.6;%PATH%"
echo Memproses Production Build SmartQ^&A ke folder dist/...
"C:\Users\Lenovo\AppData\Local\nvm\v20.19.6\node.exe" "./node_modules/vite/bin/vite.js" build
echo.
echo Build selesai! Folder "dist" siap di-publish ke Vercel / GitHub Pages / Hosting.

