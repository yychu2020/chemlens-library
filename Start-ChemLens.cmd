@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 请先安装 Node.js 22 或更新的 LTS 版本：https://nodejs.org/
 pause
 exit /b 1
)
if not exist "local\node_modules\unpdf\package.json" (
 echo 正在安装本机服务依赖，首次运行需要网络连接...
 call npm --prefix local ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org
 if errorlevel 1 (
  echo 依赖未安装成功。请检查网络后重新启动。本程序不会删除已保存资料。
  pause
  exit /b 1
 )
)
node local/server.mjs --open
pause
