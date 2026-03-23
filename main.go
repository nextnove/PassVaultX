package main

import (
	"embed"
	"os"
	"path/filepath"
	"context"

	"passvaultx/internal/config"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// 전역 변수로 선언하여 앱 전체에서 모드 판별 가능
var isDev bool

func main() {
	// 앱 인스턴스 생성
	app := NewApp()

	// 데이터 저장 경로 설정 (AppData/Roaming/...)
	configDir, _ := os.UserConfigDir()
	appName := config.AppID
	
	// 개발 중일 때는 기존 데이터를 건드리지 않도록 별도 폴더 사용
	if isDev {
		appName = config.AppIDDev
	}

	appRootPath := filepath.Join(configDir, appName)
	_ = os.MkdirAll(appRootPath, 0755) // 루트 폴더 생성
	
	// WebView2 브라우저 캐시 및 데이터가 저장될 하위 폴더
	userDataPath := filepath.Join(appRootPath, "webview")

	// Wails 실행 및 옵션 설정
	err := wails.Run(&options.App{
		Title:  config.AppName,
		Width:  1024,
		Height: 768,
		MinWidth:  800,
		MinHeight: 600,
	  // Frameless:          true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		
		// 앱 시작 시 실행될 콜백
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// 화면이 표시된 후 백그라운드에서 업데이트 확인 실행
			// (빌드 태그에 따라 실제 동작하거나 빈 함수가 호출됨)
			go CheckForUpdates()
		},
		
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
		
		// 윈도우 전용 설정
		Windows: &windows.Options{
			OnSuspend:           app.OnSuspend,
			WebviewUserDataPath: userDataPath, // 웹뷰 데이터 경로 고정
		},
	})

	if err != nil {
		println("Fatal Error:", err.Error())
	}
}