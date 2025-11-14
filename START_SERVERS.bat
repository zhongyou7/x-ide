@echo off
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    X-IDE 双模式启动器                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 请选择启动模式：
echo.
echo [1] Python HTTP服务器 (端口8001) - 轻量级，推荐开发使用
echo [2] Node.js服务器 (端口8000) - 全功能，支持文件操作
echo [3] 退出
echo.

set /p choice="请输入选项 (1-3): "

if "%choice%"=="1" goto python_server
if "%choice%"=="2" goto node_server
if "%choice%"=="3" goto exit

echo 无效选项，请重新运行脚本。
pause
exit

:python_server
echo.
echo 正在启动 Python HTTP服务器 (端口8001)...
echo 访问地址: http://localhost:8001
echo.
python -m http.server 8001
pause
exit

:node_server
echo.
echo 正在启动 Node.js服务器 (端口8000)...
echo 访问地址: http://localhost:8000
echo.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js
pause
exit

:exit
exit