//go:build !winstore

package updater

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func internalCheck(ctx context.Context, currentVersion string) {
	// API 레이트 리밋과 앱 초기 로딩 속도를 고려해 5초 뒤 실행
	time.Sleep(5 * time.Second)

	release, err := getLatestRelease()
	if err != nil {
		return
	}

	// 버전 비교 (v1.0.0 != v1.0.1)
	if release.TagName == "" || release.TagName == currentVersion {
		return
	}

	// 설치 파일 찾기
	var installerURL, portableURL string
	for _, asset := range release.Assets {
		if asset.Name == InstallerName {
			installerURL = asset.BrowserDownloadURL
		} else if asset.Name == PortableName {
			portableURL = asset.BrowserDownloadURL
		}
	}

	if installerURL != "" || portableURL != "" {
		sendUpdateEvent(ctx, release.TagName, installerURL, portableURL)
	}
}

// RunInstaller는 업데이트 파일을 다운로드하고 설치 프로그램을 실행합니다.
// 이 함수는 프론트엔드에서 사용자가 업데이트를 승인했을 때 App.StartUpdate를 통해 호출됩니다.
func RunInstaller(url string) error {
	// 1. 임시 폴더에 다운로드
	tempPath := filepath.Join(os.TempDir(), "PassVaultX_Update.exe")
	
	out, err := os.Create(tempPath)
	if err != nil {
		return err
	}
	defer out.Close()

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return err
	}
	out.Close() // 실행 전 파일을 닫아야 함

	// 2. 설치 프로그램 실행
	cmd := exec.Command(tempPath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("설치 파일 실행 실패: %w", err)
	}

	// 3. 현재 앱 종료 (설치 프로그램이 파일을 덮어쓸 수 있게 함)
	os.Exit(0)
	return nil
}
