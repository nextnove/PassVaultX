@echo off
:menu
cls
echo ============================================
echo   Wails 빌드 메뉴 (반복 모드)
echo ============================================
echo  1: 기본 빌드 (abc.exe)
echo  2: 설치형 빌드 (NSIS)
echo  3: 스토어용 빌드 (store\abc.exe)
echo  q: 종료
echo ============================================
set /p choice="번호를 선택하고 엔터를 누르세요: "

:: 공통 빌드 옵션
set CFG=-platform windows/amd64 -ldflags "-H windowsgui -s -w"

:: 각 조건마다 ( ) 괄호를 사용하여 명확히 구분합니다.
if "%choice%"=="1" (
    echo [1] 기본 빌드 시작...
    wails build %CFG%
    goto complete
)

if "%choice%"=="2" (
    echo [2] 설치형 빌드 시작...
    wails build %CFG% -nsis
    goto complete
)

if "%choice%"=="3" (
    echo [3] 스토어용 빌드 시작...
    wails build %CFG% -tags winstore -o store\PassVaultX.exe
    goto complete
)

if /i "%choice%"=="q" exit

:: 잘못된 입력 처리
echo.
echo [!] 잘못된 선택입니다. (1, 2, 3, q 중 하나를 입력하세요)
timeout /t 2 > nul
goto menu

:complete
echo.
echo --------------------------------------------
echo 빌드가 완료되었습니다!
echo 아무 키나 누르면 메뉴로 돌아갑니다...
pause > nul
goto menu