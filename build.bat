@echo off
set /p choice="빌드 타입을 선택하세요 (1: 기본, 2: 설치형, 3: 스토어): "

if "%choice%"=="1" wails build -platform windows/amd64 -ldflags "-H windowsgui -s -w"
if "%choice%"=="2" wails build -platform windows/amd64 -nsis -ldflags "-H windowsgui -s -w"
if "%choice%"=="3" wails build -platform windows/amd64 -tags winstore -ldflags "-H windowsgui -s -w"

pause